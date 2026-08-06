import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret, isEncrypted } from '@/lib/crypto/secret'

interface AdditionalRoom {
  property_name: string | null
  matched_property_id: string | null
  total_price: number | null
  num_guests: number | null
}

interface BookingExtracted {
  platform: string
  guest_name: string
  check_in: string
  check_out: string
  confirmation_id: string
  total_price: number | null
  num_guests: number
  property_name: string | null
  matched_property_id: string | null
  is_cancellation: boolean
  is_booking: boolean
  // 同一張訂單同時訂了其他房型時（第一個房型仍照上面欄位填），其餘房型各自列在這裡；
  // 全部房型共用同一位旅客與同一組入住/退房日、訂單號。
  additional_rooms?: AdditionalRoom[] | null
}

interface UserProperty {
  id: string
  name: string
  name_aliases: string[]
}

interface EmailSyncResult {
  processed: number
  added: number
  errors: string[]
  debug: {
    found_uids: number
    no_source: number
    skipped_no_checkin: number
    skipped_not_booking: number
    skipped_by_prefilter: number
    skipped_duplicate: number
    ai_null: number
    since_date: string
    log: string[]
  }
}

// 測試用開關：在 notes 附加「抓取時間」，方便追蹤每日入住 Email 擷取狀況。
// 全部完善後改為 false 即關閉（不影響其他邏輯）。
const DEBUG_FETCH_NOTE = true

// 台灣時間 YYYY-MM-DD HH:mm
function fetchNoteTag(): string {
  const t = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ')
  return `[抓取 ${t}]`
}

// 把抓取時間附加到既有 notes；會先移除舊的抓取標記避免累積。
function appendFetchNote(base: string | null | undefined): string {
  const b = (base ?? '').replace(/\s*\[抓取 [^\]]*\]/g, '').trim()
  const tag = fetchNoteTag()
  return b ? `${b} ${tag}` : tag
}

const PLATFORM_SENDERS: Record<string, string> = {
  booking_com: 'booking.com',
  agoda:       'agoda.com',
  airbnb:      'airbnb.com',
  trip_com:    'trip.com',
  asiayo:      'asiayo.com',
  easytravel:  'eztravel.com.tw',
  kkday:       'kkday.com',
  klook:       'klook.com',
  expedia:     'expedia.com',
  hotels_com:  'hotels.com',
  ctrip:       'ctrip.com',
  mafengwo:    'mafengwo.cn',
  traveloka:   'traveloka.com',
}

// Subject keywords that indicate a booking confirmation/cancellation email
const BOOKING_SUBJECT_KEYWORDS = [
  // 中文
  '訂房確認', '預訂確認', '預約確認', '訂單確認', '確認通知',
  '入住確認', '訂房成功', '預訂成功', '已確認訂單', '確認訂單',
  '訂單已確認', '已接受預訂', '已確認預訂',
  '取消確認', '取消通知', '訂單取消', '訂單已取消', '您的訂單已取消',
  '訂房已取消', '預訂已取消', '已取消',
  '行程確認', '您已接受',
  // English
  'booking confirmation', 'reservation confirmed', 'confirmed booking',
  'reservation confirmation', 'booking confirmed',
  'cancellation confirmation', 'booking cancelled', 'booking has been cancelled',
  'reservation has been cancelled', 'your booking has been cancelled',
  'new reservation', 'new booking', 'booking accepted',
  'booking no.', 'accepted', 'itinerary',
  // Trip.com specific
  'booking no.#', 'accepted#',
  // Agoda specific
  'agoda booking id', '- cancelled', 'cancelled ciao', 'cancelled',
]

// ── HTML → structured text ───────────────────────────────────
// Keep table rows / cells / line breaks so field labels stay attached to their
// values. The old approach flattened everything to single spaces, which scrambled
// "Check-in | 2026-05-31" into ambiguous token soup and caused field mismatches.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(td|th)\s*>/gi, '\t')              // cell separator
    .replace(/<\/(tr|table|div|p|li|h[1-6])\s*>/gi, '\n') // row / block break
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')                        // drop remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')                         // collapse runs of spaces/tabs
    .replace(/ *\n */g, '\n')                        // trim around line breaks
    .replace(/\n{3,}/g, '\n\n')                      // cap blank lines
    .trim()
}

// Choose the body variant that looks more likely to contain order fields.
// Some platforms send a near-empty plain-text part with all data in HTML.
function pickRicherBody(text: string, htmlStripped: string): string {
  const t = text.trim()
  const h = htmlStripped.trim()
  if (!h) return t
  if (!t) return h
  // Plain text shorter than ~40% of HTML usually means it's a stub; prefer HTML.
  if (t.length < h.length * 0.4) return h
  return t
}

// Strict YYYY-MM-DD validator (rejects impossible dates like 2026-02-31 via round-trip).
function isValidYmd(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = Date.parse(`${d}T00:00:00Z`)
  if (Number.isNaN(t)) return false
  return new Date(t).toISOString().slice(0, 10) === d
}

// ── Property name fuzzy matching ─────────────────────────────
function matchPropertyByName(name: string | null, properties: UserProperty[]): string | null {
  if (!name || !properties.length) return null
  const lower = name.toLowerCase().trim()
  const tokens = lower.split(/[\s\-_,]+/).filter(t => t.length > 1)

  // Helper: check all name variants (name + aliases)
  function variants(p: UserProperty): string[] {
    return [p.name, ...(p.name_aliases ?? [])].map(s => s.toLowerCase())
  }

  // 1. Alias exact match (highest priority — platform names like "Sea View Double Room")
  for (const p of properties) {
    if ((p.name_aliases ?? []).some(a => a.toLowerCase() === lower)) return p.id
  }

  // 2. Main name exact match
  const exact = properties.find(p => p.name.toLowerCase() === lower)
  if (exact) return exact.id

  // 3. Substring match across all variants
  const sub = properties.find(p =>
    variants(p).some(v => lower.includes(v) || v.includes(lower))
  )
  if (sub) return sub.id

  // 4. Token overlap across all variants
  const tokenMatch = properties.find(p =>
    variants(p).some(v => {
      const vTokens = v.split(/[\s\-_,]+/)
      return tokens.some(t => vTokens.includes(t))
    })
  )
  return tokenMatch?.id ?? null
}

export async function syncEmailForSetting(settingId: string): Promise<EmailSyncResult> {
  const supabase = createAdminClient()
  const result: EmailSyncResult = {
    processed: 0, added: 0, errors: [],
    debug: { found_uids: 0, no_source: 0, skipped_no_checkin: 0, skipped_not_booking: 0, skipped_by_prefilter: 0, skipped_duplicate: 0, ai_null: 0, since_date: '', log: [] },
  }
  function addLog(entry: string) {
    if (result.debug.log.length < 60) result.debug.log.push(entry)
  }
  // 略過/失敗的信持久化記錄一筆，讓 cron 背景執行也能事後追查（debug.log 只存在單次呼叫記憶體中）。
  // 失敗不可中斷主流程；呼叫時機都在 setting 確定存在之後。
  async function logSkip(reason: string, ctx: { platform?: string; subject?: string; from?: string; body?: string; detail?: string }) {
    try {
      await supabase.from('email_sync_skips').insert({
        user_id: setting!.user_id,
        email_setting_id: settingId,
        platform: ctx.platform ?? null,
        subject: (ctx.subject ?? '').slice(0, 200),
        from_address: (ctx.from ?? '').slice(0, 200),
        reason,
        detail: ctx.detail ?? null,
        body_snippet: ctx.body ? ctx.body.slice(0, 800) : null,
      })
    } catch { /* 記錄失敗不影響主流程 */ }
  }

  const { data: setting, error: se } = await supabase
    .from('email_settings')
    .select('*')
    .eq('id', settingId)
    .single()

  if (se || !setting) {
    result.errors.push(`找不到設定：${settingId}`)
    return result
  }

  // 已接通即時同步（Channex 等第三方）的民宿由第三方負責房況與訂單，
  // Email 擷取停用，避免三個資料來源互相打架。
  const { data: rtSub } = await supabase
    .from('booking_subscriptions')
    .select('realtime_sync_active')
    .eq('user_id', setting.user_id)
    .maybeSingle()
  if (rtSub?.realtime_sync_active) {
    result.errors.push('已啟用即時同步，Email 擷取已停用')
    return result
  }

  // 自癒遷移：金鑰就緒時，把舊明文密碼加密回存（之後便不再有明文）
  if (setting.imap_password && !isEncrypted(setting.imap_password)) {
    const enc = encryptSecret(setting.imap_password)
    if (enc && enc !== setting.imap_password) {
      await supabase.from('email_settings').update({ imap_password: enc }).eq('id', settingId)
    }
  }

  const { data: userProperties } = await supabase
    .from('properties')
    .select('id, name, name_aliases')
    .eq('user_id', setting.user_id)
    .eq('status', 'active')

  const properties: UserProperty[] = userProperties ?? []

  const { data: bnbProfile } = await supabase
    .from('bnb_profiles')
    .select('name')
    .eq('user_id', setting.user_id)
    .maybeSingle()

  const bnbName = bnbProfile?.name ?? null

  const fallbackPropertyId: string | null =
    setting.property_id ?? (properties.length === 1 ? properties[0].id : null)

  const rawSources: Array<{ seq: number; source: Buffer; internalDate?: Date; forceCancel?: boolean }> = []
  // 每次最多處理幾封（避免 Vercel 300 秒逾時）。超過的部分靠 last_synced_at 推進下次續傳。
  const MAX_PER_RUN = 25
  let hasMore = false
  const lastSyncedUid: number = (setting as { last_synced_uid?: number | null }).last_synced_uid ?? 0

  // 標籤模式：imap_folder 指定了非 INBOX 的自訂標籤（如「訂房」）即啟用。
  // 直接抓該標籤全部信，不靠寄件者/主旨關鍵字搜尋；預定與取消信都放在同一個
  // 「訂房」標籤，取消與否一律交給 AI 判斷（預定確認信常含「取消政策」字樣，
  // 不能靠關鍵字或獨立標籤判斷取消）。
  // cancel_folder 為選填的向後相容欄位：若另外設了取消標籤，該標籤的信強制標記為取消。
  const cancelFolder: string | null =
    (setting as { cancel_folder?: string | null }).cancel_folder || null
  const bookingLabel: string = setting.imap_folder || ''
  const labelMode = !!bookingLabel && bookingLabel.toUpperCase() !== 'INBOX'
  const isFirstSync = !setting.last_synced_at
  // 增量同步起點：上次同步時間往前 1 小時（IMAP SINCE 只到日期粒度，重疊靠去重處理）。
  const incrementalSince = setting.last_synced_at
    ? new Date(new Date(setting.last_synced_at).getTime() - 60 * 60 * 1000)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  // 標籤模式首次同步抓整個標籤的歷史信；增量則只抓 incrementalSince 之後。
  const labelSince = isFirstSync ? new Date('2000-01-01') : incrementalSince
  const imapOptions = {
    host: setting.imap_host,
    port: setting.imap_port,
    secure: true,
    auth: { user: setting.imap_user, pass: decryptSecret(setting.imap_password) ?? '' },
    logger: false as const,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 180000,
  }

  // 完整連線流程（建立連線 + 偵測信箱 + 取 lock）失敗就換一個全新 client 重試。
  // 「Connection not available」常發生在 connect 成功後、取 lock 前連線就斷掉，
  // 所以必須重試整個流程，而非只重試 connect。
  async function acquireConnection(): Promise<{
    client: ImapFlow
    lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>>
    mailboxToUse: string
  }> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
      const c = new ImapFlow(imapOptions)
      try {
        await c.connect()

        // For Gmail, auto-detect the \All folder (language-independent).
        // 標籤模式不偵測 All Mail，直接鎖定指定的「預定」標籤資料夾。
        let mailboxToUse = setting.imap_folder
        if (!labelMode && setting.imap_host.toLowerCase().includes('gmail.com')) {
          try {
            const mailboxes = await c.list()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allMail = mailboxes.find((m: any) => m.specialUse === '\\All' || m.flags?.has('\\All'))
            if (allMail) mailboxToUse = allMail.path
          } catch { /* ignore */ }
        }

        let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>>
        if (mailboxToUse !== setting.imap_folder) {
          try {
            lock = await c.getMailboxLock(mailboxToUse)
          } catch {
            // Auto-detected folder not accessible, fall back to configured folder
            mailboxToUse = setting.imap_folder
            lock = await c.getMailboxLock(mailboxToUse)
          }
        } else {
          lock = await c.getMailboxLock(mailboxToUse)
        }

        return { client: c, lock, mailboxToUse }
      } catch (e) {
        lastErr = e
        try { await c.logout() } catch { try { c.close() } catch {} }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
    throw lastErr
  }

  let client: ImapFlow
  let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>>
  let mailboxToUse: string

  try {
    const conn = await acquireConnection()
    client = conn.client
    lock = conn.lock
    mailboxToUse = conn.mailboxToUse

    try {
      result.debug.since_date = (labelMode ? labelSince : incrementalSince).toISOString().slice(0, 10)

      // Build a nested OR tree: {or:[a,{or:[b,{or:[c,d]}]}]}
      // Top-level keys outside 'or' are implicit AND (e.g. since applies to all branches).
      function buildOr(items: Record<string, unknown>[]): Record<string, unknown> {
        if (items.length === 1) return items[0]
        const [head, ...tail] = items
        return { or: [head, buildOr(tail)] }
      }

      // 用 UID（而非連線臨時的 sequence number）搜尋/抓取，讓 last_synced_uid 可以
      // 跨次執行可靠地記錄「抓到哪裡了」。IMAP SINCE 只到日期粒度，同一天內重跑
      // 排序後永遠是同一批最舊的信排最前面；沒有 UID 下限，忙碌的一天信件數一旦
      // 超過 MAX_PER_RUN，就會卡在同一批舊信、永遠碰不到當天較晚寄達的新信/取消信。
      let uids: number[] = []

      if (labelMode) {
        // 標籤模式：直接抓「預定」資料夾全部信，不靠關鍵字搜尋。
        try {
          const found = await client.search({ since: labelSince }, { uid: true })
          if (Array.isArray(found)) uids = found
        } catch { /* ignore */ }
      } else {
        // Strategy 1: one combined search across all known sender domains
        try {
          const domainCriteria = Object.values(PLATFORM_SENDERS).map(d => ({ from: `@${d}` }))
          const found = await client.search({ ...buildOr(domainCriteria), since: incrementalSince }, { uid: true })
          if (Array.isArray(found)) uids = [...uids, ...found]
        } catch { /* ignore */ }

        // Strategy 2: one combined search across key booking subject keywords
        try {
          const kwCriteria = BOOKING_SUBJECT_KEYWORDS.map(kw => ({ subject: kw }))
          const found = await client.search({ ...buildOr(kwCriteria), since: incrementalSince }, { uid: true })
          if (Array.isArray(found)) uids = [...uids, ...found]
        } catch { /* ignore */ }
      }

      // Phase 1: 一次批次串流抓取所有 raw source（取代逐封 fetchOne，速度差數十倍）。
      async function fetchBatch(list: number[], forceCancel = false) {
        if (list.length === 0) return
        for await (const msg of client.fetch(list.join(','), { source: true, internalDate: true }, { uid: true })) {
          if (msg.source) {
            const idate = msg.internalDate ? new Date(msg.internalDate) : undefined
            rawSources.push({ seq: msg.uid, source: msg.source as Buffer, internalDate: idate, forceCancel })
          } else {
            result.debug.no_source++
          }
        }
      }

      // 排除已經處理過的 UID（last_synced_uid 以前的），確保同一天內每次都能往前推進，
      // 不會卡在同一批舊信；剩下的取最舊優先的前 MAX_PER_RUN 封，其餘留待下次續傳。
      const newUids = [...new Set(uids)].filter(u => u > lastSyncedUid).sort((a, b) => a - b)
      result.debug.found_uids = newUids.length
      const batchSeqs = newUids.slice(0, MAX_PER_RUN)
      hasMore = newUids.length > batchSeqs.length

      try {
        await fetchBatch(batchSeqs)
      } catch (e) {
        // 串流中途斷線：重連一次，補抓尚未取得的部分
        if (String(e).includes('Connection not available')) {
          try { lock.release() } catch {}
          await client.connect()
          lock = await client.getMailboxLock(mailboxToUse)
          const got = new Set(rawSources.map(r => r.seq))
          await fetchBatch(batchSeqs.filter(s => !got.has(s)))
        } else {
          result.errors.push(`批次抓取失敗: ${String(e)}`)
        }
      }
    } finally {
      lock.release()
    }

    // 標籤模式：另外抓「取消」資料夾，命中的信一律標記為取消。
    if (labelMode && cancelFolder) {
      try {
        const cancelLock = await client.getMailboxLock(cancelFolder)
        try {
          const found = await client.search({ since: labelSince })
          const cancelSeqs = Array.isArray(found)
            ? [...new Set(found)].sort((a, b) => a - b).slice(0, MAX_PER_RUN)
            : []
          for await (const msg of client.fetch(cancelSeqs.join(','), { source: true, internalDate: true })) {
            if (msg.source) {
              const idate = msg.internalDate ? new Date(msg.internalDate) : undefined
              rawSources.push({ seq: msg.seq, source: msg.source as Buffer, internalDate: idate, forceCancel: true })
            }
          }
        } finally {
          cancelLock.release()
        }
      } catch (e) {
        result.errors.push(`取消資料夾抓取失敗: ${String(e)}`)
      }
    }

    try { await client.logout() } catch { /* ignore if connection already dropped */ }
  } catch (e) {
    const msg = `IMAP 連線失敗: ${String(e)}`
    result.errors.push(msg)
    // Only return early if nothing was fetched — otherwise fall through to Phase 2
    if (rawSources.length === 0) {
      await supabase.from('email_settings').update({
        last_sync_error: msg,
        last_synced_at: new Date().toISOString(),
      }).eq('id', settingId)
      return result
    }
  }

  // Phase 2: parse + AI + Supabase (no IMAP connection needed)
  for (const { seq, source, forceCancel } of rawSources) {
    try {
      const parsed = await simpleParser(source)
      const from    = parsed.from?.text ?? ''
      const subject = parsed.subject ?? ''
      const text    = parsed.text ?? ''
      const html    = (parsed.html as string | false | null | undefined) || ''
      const htmlStripped = typeof html === 'string' ? htmlToText(html) : ''
      const body    = pickRicherBody(text, htmlStripped)

      let platform = 'other'
      for (const [key, domain] of Object.entries(PLATFORM_SENDERS)) {
        if (from.toLowerCase().includes(domain)) { platform = key; break }
      }

      const subj80 = subject.slice(0, 80)
      if (platform !== 'other') addLog(`[掃描] ${platform} | ${subj80}`)

      // Stage 1：便宜分類先篩掉明顯非訂單信（標籤模式整個資料夾都抓，不靠關鍵字篩，
      // 大部分信件其實是取消政策說明、客服往來、轉寄信等雜訊），避免每一封都花
      // Stage 2 完整擷取（含房型清單／平台提示／少樣本範例）的成本。
      // 來自「取消」資料夾的信已經確定是訂單，跳過分類直接進 Stage 2。
      if (!forceCancel) {
        const looksLikeBooking = await classifyIsBooking(subject, body)
        if (!looksLikeBooking) {
          result.debug.skipped_by_prefilter++
          addLog(`[非訂房-預篩] ${platform} | ${subj80}`)
          await logSkip('prefilter_not_booking', { platform, subject, from, body })
          continue
        }
      }

      const extracted = await extractBookingWithAI(subject, body, platform, properties, bnbName)
      if (!extracted) {
        result.debug.ai_null++; addLog(`[AI失敗] ${platform} | ${subj80}`)
        await logSkip('ai_extraction_failed', { platform, subject, from, body })
        continue
      }
      // 來自「取消」資料夾的信一律視為取消（不靠 AI 判斷取消意圖）。
      if (forceCancel) { extracted.is_cancellation = true; extracted.is_booking = true }
      if (!extracted.is_booking) {
        result.debug.skipped_not_booking++; addLog(`[非訂房] ${platform} | ${subj80}`)
        await logSkip('ai_says_not_booking', { platform, subject, from, body })
        continue
      }

      const validMatchedId =
        extracted.matched_property_id && properties.some(p => p.id === extracted.matched_property_id)
          ? extracted.matched_property_id
          : null

      const resolvedPropertyId =
        validMatchedId
        ?? matchPropertyByName(extracted.property_name, properties)
        ?? fallbackPropertyId

      const checkIn = isValidYmd(extracted.check_in) ? extracted.check_in : null
      const validCheckOut =
        isValidYmd(extracted.check_out) && checkIn && extracted.check_out > checkIn
          ? extracted.check_out
          : null
      const checkOut = validCheckOut || (checkIn
        ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
        : null)

      if (!checkIn) {
        result.debug.skipped_no_checkin++; addLog(`[無入住日] ${platform} | ci=${extracted.check_in} | ${subj80}`)
        await logSkip('no_valid_checkin', { platform, subject, from, body, detail: `AI 回傳的 check_in="${extracted.check_in}"` })
        result.processed++; continue
      }

      const isPartial = !validCheckOut || !extracted.guest_name
      const bookingStatus = extracted.is_cancellation ? 'cancelled' : (isPartial ? 'pending' : 'confirmed')

      // 一張訂單可能同時訂了多個不同房型（見 extractBookingWithAI 的 additional_rooms）。
      // 全部房型共用同一位旅客、同一組入住/退房日、同一個訂單號；用 property_id 拆成多筆
      // bookings（unique 限制已在 migration 090 放寬成含 property_id）。
      const baseConfId = extracted.confirmation_id || null
      const roomEntries: Array<{ propertyId: string | null; totalPrice: number | null; numGuests: number | null; confId: string }> = [
        { propertyId: resolvedPropertyId, totalPrice: extracted.total_price, numGuests: extracted.num_guests, confId: baseConfId || `email_${settingId}_${seq}` },
      ]
      const extraRooms = Array.isArray(extracted.additional_rooms) ? extracted.additional_rooms : []
      extraRooms.forEach((r, i) => {
        const validId = r.matched_property_id && properties.some(p => p.id === r.matched_property_id) ? r.matched_property_id : null
        roomEntries.push({
          propertyId: validId ?? matchPropertyByName(r.property_name, properties),
          totalPrice: r.total_price ?? null,
          numGuests: r.num_guests ?? null,
          confId: baseConfId || `email_${settingId}_${seq}-r${i + 1}`,
        })
      })
      const multiRoom = roomEntries.length > 1

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function filterByProperty(q: any, propertyId: string | null) {
        return propertyId ? q.eq('property_id', propertyId) : q.is('property_id', null)
      }

      for (const room of roomEntries) {
        const { propertyId: resolvedPropertyId, confId } = room
        const roomTotalPrice = room.totalPrice ?? (multiRoom ? null : extracted.total_price)
        const roomNumGuests = room.numGuests ?? (multiRoom ? null : extracted.num_guests)

        // ── iCal 為主要來源，Email 只負責補齊資料 ──────────────────
        // 有設定 iCal 同步時，訂房阻擋已經靠 iCal 完成；若這封信對應到一筆已存在的
        // iCal 訂單（同平台＋同房型＋同入住退房日），把姓名／金額／人數等 iCal
        // 沒有的細節補進去（或標記取消），不要另外新增一筆重複訂單。
        if (validCheckOut) {
          let icalQ = supabase
            .from('bookings')
            .select('id, status, guest_name, total_price, num_guests, notes')
            .eq('user_id', setting.user_id)
            .eq('platform', platform)
            .eq('check_in', checkIn)
            .eq('check_out', validCheckOut)
            .eq('source', 'ical')
          if (resolvedPropertyId) icalQ = icalQ.eq('property_id', resolvedPropertyId)
          const { data: icalBooking } = await icalQ.maybeSingle()
          if (icalBooking) {
            const patch: Record<string, unknown> = {}
            if (extracted.is_cancellation) {
              if (icalBooking.status !== 'cancelled') patch.status = 'cancelled'
            } else {
              if (extracted.guest_name && (!icalBooking.guest_name || icalBooking.guest_name === '(iCal 訂單)'))
                patch.guest_name = extracted.guest_name
              if (roomTotalPrice != null && icalBooking.total_price == null)
                patch.total_price = roomTotalPrice
              if (roomNumGuests && (icalBooking.num_guests == null || icalBooking.num_guests <= 1))
                patch.num_guests = roomNumGuests
            }
            if (Object.keys(patch).length > 0) {
              if (DEBUG_FETCH_NOTE) patch.notes = appendFetchNote(icalBooking.notes)
              await supabase.from('bookings').update(patch).eq('id', icalBooking.id)
              addLog(`[補齊iCal✓] ${confId} | ${subj80}`)
              result.added++
            } else {
              result.debug.skipped_duplicate++
            }
            continue
          }
        }

        // Duplicate check 1: exact confirmation_id + property match
        // （同一單號現在可能對應多筆房型，一定要搭配 property 篩選才能鎖到「這個房型」的那一筆）
        const { data: dupById } = await filterByProperty(
          supabase
            .from('bookings')
            .select('id, status, guest_name, check_in, check_out, total_price, num_guests, property_id, notes')
            .eq('user_id', setting.user_id)
            .eq('platform_booking_id', confId),
          resolvedPropertyId,
        ).maybeSingle()
        if (dupById) {
          if (extracted.is_cancellation && dupById.status !== 'cancelled') {
            await supabase.from('bookings').update({
              status: 'cancelled',
              ...(DEBUG_FETCH_NOTE ? { notes: appendFetchNote(dupById.notes) } : {}),
            }).eq('id', dupById.id)
            addLog(`[取消✓ dup1] ${confId} | ${subj80}`)
            result.added++
            continue
          }
          if (extracted.is_cancellation && dupById.status === 'cancelled') {
            addLog(`[已取消skip] ${confId} | ${subj80}`)
          }
          const patch: Record<string, unknown> = {}
          if (extracted.guest_name && (!dupById.guest_name || dupById.guest_name === '(待補充)'))
            patch.guest_name = extracted.guest_name
          // check_in 只在訂單還沒確認（status 仍是 pending，代表當初是 AI 沒解析完整才建立的
          // 佔位資料）時才允許校正；已經是 confirmed 的訂單絕不動 check_in，避免誤蓋掉真實資料。
          if (checkIn && checkIn !== dupById.check_in && dupById.status === 'pending')
            patch.check_in = checkIn
          // 只在缺資料（沒有 check_out）或信件延後退房日時才更新，絕不往回改：
          // 每日入住的「續住」會直接延後訂單的 check_out，若這裡照信件內容無條件覆寫，
          // 同一張訂單的信只要被重新處理到，就會把手動續住延長的天數改回去，
          // 連帶讓那天的每日入住資料被清空（GET 找不到涵蓋當天的有效訂單）。
          if (validCheckOut && (!dupById.check_out || validCheckOut > dupById.check_out))
            patch.check_out = validCheckOut
          if (roomTotalPrice != null && dupById.total_price == null)
            patch.total_price = roomTotalPrice
          if (roomNumGuests && (dupById.num_guests == null || dupById.num_guests <= 1))
            patch.num_guests = roomNumGuests
          if (resolvedPropertyId && !dupById.property_id)
            patch.property_id = resolvedPropertyId
          const hadPatch = Object.keys(patch).length > 0
          if (hadPatch && !extracted.is_cancellation && dupById.status === 'pending' && !isPartial) {
            patch.status = 'confirmed'
            patch.notes = null
          }
          if (DEBUG_FETCH_NOTE) {
            patch.notes = appendFetchNote('notes' in patch ? (patch.notes as string | null) : dupById.notes)
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from('bookings').update(patch).eq('id', dupById.id)
            if (hadPatch) result.added++; else result.debug.skipped_duplicate++
          } else {
            result.debug.skipped_duplicate++
          }
          continue
        }

        // Duplicate check 2: same platform + check_in + check_out + guest_name + property
        // （多房型訂單共用同一位旅客/同一組日期，一定要加 property 篩選，否則會把不同房型的兩筆訂單互相誤判成重複）
        let existingId: string | null = null
        if (checkIn && extracted.guest_name && checkOut) {
          const { data: dupByGuest } = await filterByProperty(
            supabase
              .from('bookings')
              .select('id, total_price, platform_booking_id')
              .eq('user_id', setting.user_id)
              .eq('platform', platform)
              .eq('check_in', checkIn)
              .eq('check_out', checkOut)
              .eq('source', 'email')
              .ilike('guest_name', `%${extracted.guest_name.split(/[\s/]/)[0]}%`),
            resolvedPropertyId,
          ).maybeSingle()
          if (dupByGuest) {
            existingId = dupByGuest.id
            if (extracted.is_cancellation) {
              await supabase.from('bookings').update({
                status: 'cancelled',
                ...(DEBUG_FETCH_NOTE ? { notes: appendFetchNote(null) } : {}),
              }).eq('id', existingId)
              addLog(`[取消✓ dup2] ${confId} | ${subj80}`)
              result.added++; continue
            }
            if (extracted.confirmation_id && dupByGuest.platform_booking_id?.startsWith('email_')) {
              await supabase.from('bookings').update({
                platform_booking_id: extracted.confirmation_id,
                total_price: roomTotalPrice ?? dupByGuest.total_price,
                status: 'confirmed',
                notes: DEBUG_FETCH_NOTE ? appendFetchNote(null) : null,
              }).eq('id', existingId)
            } else if (DEBUG_FETCH_NOTE) {
              await supabase.from('bookings').update({ notes: appendFetchNote(null) }).eq('id', existingId)
            }
            result.debug.skipped_duplicate++; continue
          }
        }

        // Duplicate check 3: same platform + check_in + property (looser, last resort).
        // 必須有明確配對到的房型才跑：resolvedPropertyId 為 null 時（房型模糊比對失敗，
        // 很常見）若不篩房型，會變成「同平台＋同入住日」就判定重複，把不同房源、不同
        // 旅客的訂單誤判成同一筆而整個吞掉，訂單就再也不會出現在每日入住表。
        if (checkIn && !existingId && resolvedPropertyId) {
          const { data: dup } = await supabase
            .from('bookings')
            .select('id, status')
            .eq('user_id', setting.user_id)
            .eq('platform', platform)
            .eq('check_in', checkIn)
            .eq('source', 'email')
            .eq('property_id', resolvedPropertyId)
            .maybeSingle()
          if (dup) {
            if (extracted.is_cancellation && dup.status !== 'cancelled') {
              await supabase.from('bookings').update({
                status: 'cancelled',
                ...(DEBUG_FETCH_NOTE ? { notes: appendFetchNote(null) } : {}),
              }).eq('id', dup.id)
              addLog(`[取消✓ dup3] ${confId} | ${subj80}`)
              result.added++
            } else {
              addLog(`[重複skip] ${confId} canc=${extracted.is_cancellation} dupStatus=${dup.status} | ${subj80}`)
              result.debug.skipped_duplicate++
            }
            continue
          }
        }

        const { error: bkErr } = await supabase
          .from('bookings')
          .upsert({
            user_id:             setting.user_id,
            property_id:         resolvedPropertyId,
            platform,
            platform_booking_id: confId,
            guest_name:          extracted.guest_name || '(待補充)',
            check_in:            checkIn,
            check_out:           checkOut,
            num_guests:          roomNumGuests || 1,
            total_price:         roomTotalPrice,
            status:              bookingStatus,
            source:              'email',
            notes:               (() => {
              const base = isPartial ? '由 Email 部分擷取，請至平台後台確認完整資料' : null
              return DEBUG_FETCH_NOTE ? appendFetchNote(base) : base
            })(),
            raw_data:            { subject, from, confirmation_id: extracted.confirmation_id, property_name: extracted.property_name },
          }, { onConflict: 'user_id,platform,platform_booking_id,property_id' })

        if (bkErr) {
          result.errors.push(`訂單 upsert 失敗: ${bkErr.message}`)
          addLog(`[新增失敗] ${confId} ${bkErr.message.slice(0,40)}`)
        } else {
          addLog(`[新增✓] ${confId} ${checkIn}→${checkOut} canc=${extracted.is_cancellation} | ${subj80}`)
          result.added++
        }
      }
      result.processed++
    } catch (e) {
      result.errors.push(`處理郵件 ${seq} 失敗: ${String(e)}`)
    }
  }

  // 還有未處理的 backlog：把 last_synced_at 推進到本批已處理最新信的時間，下次續傳；
  // 否則（已追上）設為現在。
  let nextSyncedAt = new Date().toISOString()
  if (hasMore) {
    const times = rawSources
      .map(r => r.internalDate?.getTime())
      .filter((t): t is number => typeof t === 'number')
    if (times.length) nextSyncedAt = new Date(Math.max(...times)).toISOString()
  }

  // 本批實際抓到的最大 UID（非取消資料夾，因為那是另一個信箱、UID 不共通），
  // 讓下次執行能跳過已處理過的信，避免忙碌天數卡在同一批舊信、碰不到當天較晚的新信。
  const bookingFolderUids = rawSources.filter(r => !r.forceCancel).map(r => r.seq)
  const nextSyncedUid = bookingFolderUids.length > 0
    ? Math.max(lastSyncedUid, ...bookingFolderUids)
    : lastSyncedUid

  await supabase.from('email_settings').update({
    last_synced_at:  nextSyncedAt,
    last_synced_uid: nextSyncedUid || null,
    last_sync_count: result.added,
    last_sync_error: result.errors.length > 0 ? result.errors[0] : null,
  }).eq('id', settingId)

  return result
}

export async function syncAllEmailForUser(userId: string, onlyEnabled = false) {
  const supabase = createAdminClient()
  let query = supabase.from('email_settings').select('id').eq('user_id', userId)
  if (onlyEnabled) query = query.eq('sync_enabled', true)

  const { data: settings } = await query
  if (!settings?.length) return []
  return Promise.all(settings.map((s: { id: string }) => syncEmailForSetting(s.id)))
}

// ── Platform-specific extraction hints (derived from real sample emails) ──
const PLATFORM_HINTS: Record<string, string> = {
  booking_com: `Booking.com：
- 訂單號為純數字 9-10 位，出現在主旨「(數字, 日期)」、內文「Booking information — 數字」「確認訂房編號為 數字」或網址「res_id=數字」。
- 兩段式郵件：入住日前的通知常只有入住/退房日期與訂單號，沒有姓名/房型/金額（正常，is_booking 仍為 true）；入住當天才會有完整房客資訊。
- 日期格式如「2026年6月5日」。
- 一張訂單可能同時訂了不同房型（內文會分段列出多個房型各自的房型名稱與金額，姓名與訂單號只出現一次、適用全部房型）；此時把第一個房型填在主要欄位，其餘房型依序放進 additional_rooms。`,
  agoda: `Agoda：
- 訂單號為純數字（約 10 位），出現在主旨「Agoda 訂單 數字」或「Agoda Booking ID 數字」、內文「訂房編號」下一行。
- 欄位標籤：訂房編號 / 入住 / 退房 / 房型 / 入住人數 / 房客姓名 / 總金額。
- 取消郵件：主旨常含「CANCELLED」（大寫）、「已取消」，內文含「您的訂單已取消」「This booking has been cancelled」→ is_cancellation=true, is_booking=true；仍需擷取訂單號與入住退房日。
- 連住多晚：郵件會同時顯示入住日（Check-in/入住）與退房日（Check-out/退房），兩個日期都要擷取，不可只取入住日。
- 金額如「TWD 3,600」；房客姓名格式「姓, 名」。`,
  trip_com: `Trip.com：
- 訂單號為純數字（約 16 位），出現在主旨「Booking no.數字」、內文「訂單編號」或「預約編號」/「飯店確認編號」下一行；同一封信主旨常把訂單號重複 2-3 次（如「已確認訂單編號 #X#//Booking no. #X# accepted#X#」），是同一個號碼，不要誤判成多筆訂單。
- 兩種常見版式，欄位標籤不同，兩種都要認得：
  1) 取消/一般通知信：訂單編號 / 入住 / 退房 / 房型 / 住客姓名 / 房間數 / 入住人數 / 總價。
  2) 「已確認訂單」／「您已接受旅客的預訂」（房東接單通知）：預約編號 / 飯店確認編號 / 旅客姓名 / 房型（後面可能接「-Commission NN%」「保留房」等標籤，只取房型名稱本身）/ 床型 / 住宿日期「YYYY 年 M 月 D 日 - YYYY 年 M 月 D 日｜N 晚」（第一個日期入住、第二個退房）/ 抵達時間 / 每日餐點 / 預計到店人數。
- 主旨「Cancellation request accepted」或內文「訂單已取消」→ is_cancellation true。
- 房客姓名格式「姓/名」。`,
  asiayo: `AsiaYo：
- 訂單號為純數字 12 碼（格式類似 YYYYMMDD+序號，如 202605260319），出現在主旨括號內與內文「訂單編號」下一行。
- 入住/退房日期格式為 YYYY/MM/DD（如 2026/07/10、2026/07/12）。
- 欄位標籤：訂單編號 / 入住日期 / 退房日期 / 房型 / 住客姓名（格式「名 姓」）/ 入住人數（大人＋小孩）/ 訂單金額。`,
}

// Few-shot examples distilled from real (de-identified) sample emails. They teach
// the model the trickiest per-platform shapes: Booking.com's order-number-only
// pre-stay email, the 姓/名 guest format, and cancellation wording.
const FEW_SHOT_EXAMPLES: Record<string, string> = {
  booking_com: `範例1（單一房型，入住日前通知）：輸入主旨：「Booking.com - 新的預訂！ (5155978344, 2026年6月5日星期五)」
輸入內文片段：「Booking information — 5155978344 … res_id=5155978344」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":null,"check_in":"2026-06-05","check_out":null,"confirmation_id":"5155978344","total_price":null,"num_guests":null,"property_name":null,"matched_property_id":null,"platform":"booking_com"}
（說明：入住日前通知常只有訂單號與入住日，其餘填 null，不要猜測。）

範例2（一張訂單同時訂兩個不同房型）：內文「Booking information — 6203344521 … Rong Tenghao … 入住 2026-08-28 退房 2026-08-29 … 房型 1：蘭博大床房，TWD 1800 … 房型 2：山景大床房，TWD 1800」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":"Rong Tenghao","check_in":"2026-08-28","check_out":"2026-08-29","confirmation_id":"6203344521","total_price":1800,"num_guests":null,"property_name":"蘭博大床房","matched_property_id":null,"platform":"booking_com","additional_rooms":[{"property_name":"山景大床房","matched_property_id":null,"total_price":1800,"num_guests":null}]}
（說明：兩個房型共用同一訂單號與旅客姓名，第一個房型填主要欄位，第二個房型放進 additional_rooms。）`,
  agoda: `範例1（確認，1晚）：內文「訂單編號 1732718574 … Check-in 入住 11-Jul-2026 … Check-out 退房 12-Jul-2026 … 顧客名 RueiJie 姓 Chen … Mountain View Double Room … 2 Adults … TWD 1,911.00」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":"RueiJie Chen","check_in":"2026-07-11","check_out":"2026-07-12","confirmation_id":"1732718574","total_price":1911,"num_guests":2,"property_name":"Mountain View Double Room","matched_property_id":null,"platform":"agoda"}

範例2（確認，3晚）：內文「訂房編號 1723090474 … 入住 10-Jul-2026 … 退房 13-Jul-2026 … 顧客名 Wei 姓 Lin … Sea View Room … 2 Adults … TWD 5,400.00」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":"Wei Lin","check_in":"2026-07-10","check_out":"2026-07-13","confirmation_id":"1723090474","total_price":5400,"num_guests":2,"property_name":"Sea View Room","matched_property_id":null,"platform":"agoda"}

範例3（取消）：主旨「Agoda - CANCELLED (1731646163)」；內文「訂房編號 1731646163 … 入住 28-May-2026 … 退房 29-May-2026 … This booking has been cancelled」
正確輸出：{"is_booking":true,"is_cancellation":true,"guest_name":null,"check_in":"2026-05-28","check_out":"2026-05-29","confirmation_id":"1731646163","total_price":null,"num_guests":null,"property_name":null,"matched_property_id":null,"platform":"agoda"}`,
  trip_com: `範例1（取消通知）：輸入主旨：「【訂單已取消】… Cancellation request accepted (booking no. #1616330516335375#)」
輸入內文片段：「訂單編號 1616330516335375 … 旅客姓名 HUANG/YA CHI … 訂單金額 TWD 1377 … 住宿日期 2026 年 6 月 16 日 - 2026 年 6 月 17 日」
正確輸出：{"is_booking":true,"is_cancellation":true,"guest_name":"HUANG/YA CHI","check_in":"2026-06-16","check_out":"2026-06-17","confirmation_id":"1616330516335375","total_price":1377,"num_guests":null,"property_name":"Standard Double Room","matched_property_id":null,"platform":"trip_com"}

範例2（房東接單通知，訂單號在主旨重複多次）：輸入主旨：「已確認訂單編號 #1616399988877766#//Booking no. #1616399988877766# accepted#1616399988877766#」
輸入內文片段：「已確認訂單 您已接受旅客的預訂 預約編號1616399988877766 飯店確認編號 1616399988877766 … 旅客姓名：WANG/XIAO MING 房型：豪華雙人房 breakfast-Commission 15%｜1房 保留房 床型：1張特大床 住宿日期：2026 年 9 月 10 日 - 2026 年 9 月 12 日｜2 晚 抵達時間：9 月 10 日 15:00 - 9 月 12 日 06:00 每日餐點：2 客普通早餐 預計到店人數：2 位成人」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":"WANG/XIAO MING","check_in":"2026-09-10","check_out":"2026-09-12","confirmation_id":"1616399988877766","total_price":null,"num_guests":2,"property_name":"豪華雙人房","matched_property_id":null,"platform":"trip_com"}
（說明：主旨裡同一個訂單號出現 3 次是正常格式，不是 3 筆訂單；房型後面的「-Commission 15%」「保留房」是佣金/狀態標籤，不算房型名稱的一部分；住宿日期用第一個日期當入住、第二個當退房，不要用「N 晚」去反推。）`,
  asiayo: `輸入主旨：「AsiaYo.com 訂房已確認通知 (202605260319)」
輸入內文片段：「訂單編號 202605260319 … 會員姓名 函霓 林 … 大人：1 位 小孩：0 位 … 海景房: 最多4人入住 … 入住日期 2026/07/10 退房日期 2026/07/12 … 已付金額 4,838」
正確輸出：{"is_booking":true,"is_cancellation":false,"guest_name":"函霓 林","check_in":"2026-07-10","check_out":"2026-07-12","confirmation_id":"202605260319","total_price":4838,"num_guests":1,"property_name":"海景房: 最多4人入住","matched_property_id":null,"platform":"asiayo"}`,
}

// Order-number shapes per platform — used for cheap regex anchoring + fallback.
const CONF_ID_PATTERNS: Record<string, RegExp> = {
  booking_com: /\b\d{9,10}\b/,
  agoda:       /\b\d{9,11}\b/,
  trip_com:    /\b\d{15,18}\b/,
  asiayo:      /\b\d{12}\b/,
}

// High-confidence regex pre-extraction to anchor the model and to fall back on
// when it misses the order number / dates.
function regexPreExtract(subject: string, body: string, platform: string): {
  confirmation_id: string | null
  dates: string[]
} {
  const hay = `${subject}\n${body}`
  let confirmation_id: string | null = null
  const pat = CONF_ID_PATTERNS[platform]
  if (pat) {
    const m = hay.match(pat)
    if (m) confirmation_id = m[0]
  }
  const dates: string[] = []
  let mm: RegExpExecArray | null
  // 中文日期，容忍空格：「2026年6月5日」「2026 年 7 月 6 日」(Trip.com)
  const reCn = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g
  while ((mm = reCn.exec(hay))) dates.push(`${mm[1]}-${mm[2].padStart(2, '0')}-${mm[3].padStart(2, '0')}`)
  // 斜線日期 YYYY/MM/DD (AsiaYo)
  const reSlash = /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/g
  while ((mm = reSlash.exec(hay))) dates.push(`${mm[1]}-${mm[2].padStart(2, '0')}-${mm[3].padStart(2, '0')}`)
  // ISO YYYY-MM-DD
  const reIso = /\b(\d{4}-\d{2}-\d{2})\b/g
  while ((mm = reIso.exec(hay))) dates.push(mm[1])
  return { confirmation_id, dates: [...new Set(dates)].sort() }
}

// ── Stage 1: cheap pre-filter ─────────────────────────────────
// 標籤模式整個資料夾都抓、不靠關鍵字篩（怕漏掉措辭不一的取消信），實際大部分
// 信件是取消政策說明、客服往來、轉寄信等雜訊。這裡用極小的 prompt（不含房型
// 清單／平台提示／少樣本範例）先做便宜的二元分類，只有判斷像訂單的信才送進
// Stage 2 完整擷取，大幅降低平均每封信的成本。
async function classifyIsBooking(subject: string, body: string): Promise<boolean> {
  const truncated = body.slice(0, 1500)
  const prompt = `判斷以下郵件是否為訂房平台的「訂房確認」或「訂房取消」通知信（不是訂房須知、行銷信、一般客服往來、或其他無關信件）。

郵件主旨：${subject}
郵件內容片段：
${truncated}

只回傳 JSON，不要其他說明：{"is_booking": true 或 false}`

  const providers: Array<'deepseek' | 'claude'> = []
  if (process.env.DEEPSEEK_API_KEY) providers.push('deepseek')
  if (process.env.ANTHROPIC_API_KEY) providers.push('claude')
  if (providers.length === 0) return true // 無可用模型時不篩選，安全預設全部送進 Stage 2

  for (const provider of providers) {
    try {
      const responseText = await callModel(provider, prompt, 50)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue
      const parsed = JSON.parse(jsonMatch[0]) as { is_booking?: boolean }
      if (typeof parsed.is_booking === 'boolean') return parsed.is_booking
    } catch {
      // try next provider
    }
  }
  return true // 分類失敗時安全預設為可能是訂單，交給 Stage 2 完整擷取判斷，避免漏單
}

// ── Stage 2: AI Extraction ────────────────────────────────────

async function extractBookingWithAI(
  subject: string,
  body: string,
  platform: string,
  properties: UserProperty[],
  bnbName: string | null
): Promise<BookingExtracted | null> {
  const truncatedBody = body.slice(0, 8000)

  const bnbLine = bnbName ? `\n此民宿名稱（所有訂單都屬於此民宿）：${bnbName}` : ''
  const roomListStr = properties.length > 0
    ? `\n已知房型清單（請判斷是哪個房型，回傳其 id）：\n${properties.map(p => {
        const aliases = (p.name_aliases ?? []).length > 0 ? `，別名：${p.name_aliases.join('、')}` : ''
        return `- id: "${p.id}", 房型名稱: "${p.name}"${aliases}`
      }).join('\n')}`
    : ''

  const hint = PLATFORM_HINTS[platform] ? `\n平台專屬規則：\n${PLATFORM_HINTS[platform]}` : ''
  const pre = regexPreExtract(subject, body, platform)
  const preLine = (pre.confirmation_id || pre.dates.length)
    ? `\n程式預擷取（高信心，可作為校驗依據；若與內文一致請採用）：\n- 可能的訂單號：${pre.confirmation_id ?? '無'}\n- 內文偵測到的日期（已轉 YYYY-MM-DD，通常較小者為入住、較大者為退房）：${pre.dates.join('、') || '無'}`
    : ''

  const fewShot = FEW_SHOT_EXAMPLES[platform] ? `\n參考範例（同平台真實格式，協助你對應欄位）：\n${FEW_SHOT_EXAMPLES[platform]}` : ''

  const prompt = `從以下訂房平台郵件中擷取訂單資訊，回傳 JSON 格式。
${bnbLine}
郵件主旨：${subject}
平台：${platform}
郵件內容：
${truncatedBody}
${roomListStr}${hint}${preLine}${fewShot}

通用注意：
- confirmation_id 務必從主旨或內文找出；純數字平台不要把電話、金額、日期數字當成訂單號。
- 日期一律輸出 YYYY-MM-DD；中文「2026年6月5日」要轉成「2026-06-05」；退房日必須晚於入住日。
- 連住多晚時，check_out 必須填最後退房日（不是入住日+1天）。若郵件標明「退房 7/13」check_out=2026-07-13；若只有「住 N 晚」，check_out = check_in + N 天。
- 取消類郵件 is_cancellation 設 true，但 is_booking 仍為 true；盡量從郵件擷取 confirmation_id、入住/退房日。
- 重要：「取消政策」「取消條款」「免費取消」「cancellation policy」「free cancellation」屬於訂房須知/條款用語，不代表此訂單已被取消。is_cancellation 只有在郵件明確表示本訂單「已取消／被取消／cancelled／canceled／cancellation request accepted」時才設為 true；若只是預定確認信中提到取消政策，is_cancellation 必須為 false。
- 重要：同一張訂單有時會同時訂「不同房型」（例如一次訂了兩間不同的房，共用同一個訂單號、同一位旅客、同一組入住/退房日，只是房型和金額分開列）。這種情況下，把「第一個房型」照 property_name/matched_property_id/total_price/num_guests 正常填；其餘每個房型各自的房型名稱/id/金額/人數，依序放進 additional_rooms 陣列（一個房型一個物件）。只有真的同一張訂單訂了多個不同房型才需要 additional_rooms；只訂一個房型（就算訂了好幾晚）不要填這個欄位，也不要把「連住多晚」誤判成多房型。
- 無法確定的欄位填 null，不要猜測。

請回傳以下 JSON（無法確定的欄位填 null，不要猜測）：
{
  "is_booking": true 或 false（是否為訂房確認/取消郵件）,
  "is_cancellation": true 或 false,
  "guest_name": "旅客姓名，無法取得填 null",
  "check_in": "YYYY-MM-DD，入住日期",
  "check_out": "YYYY-MM-DD，退房日期，無法取得填 null",
  "confirmation_id": "訂單確認號/預約編號",
  "total_price": 數字或null（第一個房型的金額；若整張訂單只有一個總金額、無法拆分各房型，填整張訂單總額並讓 additional_rooms 的 total_price 都填 null）,
  "num_guests": 數字或null,
  "property_name": "郵件中出現的房型名稱（如：標準雙人房、Standard Double Room），無房型資訊填 null",
  "matched_property_id": "從已知房型清單中最符合的 id，若無法確定則為 null",
  "platform": "${platform}",
  "additional_rooms": [{"property_name": "...", "matched_property_id": "...或null", "total_price": 數字或null, "num_guests": 數字或null}]（只有同一訂單訂了多個不同房型才需要，否則整個欄位省略或填 null）
}

只回傳 JSON，不要其他說明。`

  // Build the provider attempt order: Claude Haiku first（結構化多欄位擷取穩定度
  // 明顯優於 DeepSeek，Stage 1 已經把大部分雜訊信篩掉，這裡數量少很多，值得用
  // 較準的模型），DeepSeek 作為備援；一個失敗或回傳壞 JSON 時換另一個，而不是
  // 直接放棄整封信。
  const providers: Array<'deepseek' | 'claude'> = []
  if (process.env.ANTHROPIC_API_KEY) providers.push('claude')
  if (process.env.DEEPSEEK_API_KEY) providers.push('deepseek')
  if (providers.length === 0) return null

  for (const provider of providers) {
    // One retry per provider for transient errors / truncated JSON.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const responseText = await callModel(provider, prompt)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue
        const parsed = JSON.parse(jsonMatch[0]) as BookingExtracted
        // Fall back to the regex-detected order number when the model missed it.
        if (!parsed.confirmation_id && pre.confirmation_id) parsed.confirmation_id = pre.confirmation_id
        return parsed
      } catch {
        // try again / next provider
      }
    }
  }
  return null
}

async function callModel(provider: 'deepseek' | 'claude', prompt: string, maxTokens = 1000): Promise<string> {
  if (provider === 'deepseek') {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}
