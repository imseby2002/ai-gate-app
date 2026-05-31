import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createAdminClient } from '@/lib/supabase/admin'

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
    skipped_no_checkin: number
    skipped_not_booking: number
    skipped_duplicate: number
    ai_null: number
    since_date: string
  }
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
  '取消確認', '取消通知', '訂單取消',
  '行程確認', '您已接受',
  // English
  'booking confirmation', 'reservation confirmed', 'confirmed booking',
  'reservation confirmation', 'booking confirmed',
  'cancellation confirmation', 'booking cancelled',
  'new reservation', 'new booking', 'booking accepted',
  'booking no.', 'accepted', 'itinerary',
  // Trip.com specific
  'booking no.#', 'accepted#',
  // Agoda specific
  'agoda booking id', '- cancelled', 'cancelled ciao',
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
    debug: { found_uids: 0, skipped_no_checkin: 0, skipped_not_booking: 0, skipped_duplicate: 0, ai_null: 0, since_date: '' },
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

  const client = new ImapFlow({
    host: setting.imap_host,
    port: setting.imap_port,
    secure: true,
    auth: { user: setting.imap_user, pass: setting.imap_password },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(setting.imap_folder)

    try {
      // Extra 1-day buffer to avoid timezone edge issues; IMAP SINCE is date-only
      const baseSince = setting.last_synced_at
        ? new Date(new Date(setting.last_synced_at).getTime() - 86400000)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      result.debug.since_date = baseSince.toISOString().slice(0, 10)

      let seqs: number[] = []

      // Strategy 1: search by known sender domains
      for (const domain of Object.values(PLATFORM_SENDERS)) {
        try {
          const found = await client.search({ from: `@${domain}`, since: baseSince })
          if (Array.isArray(found)) seqs = [...seqs, ...found]
        } catch { /* server may not support FROM search */ }
      }

      // Strategy 2: search by subject keywords
      for (const kw of BOOKING_SUBJECT_KEYWORDS) {
        try {
          const found = await client.search({ subject: kw, since: baseSince })
          if (Array.isArray(found)) seqs = [...seqs, ...found]
        } catch { /* server may not support subject search */ }
      }

      // Strategy 3: ALWAYS scan all emails in last 7 days — catches anything missed above
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const recentSince = baseSince < sevenDaysAgo ? sevenDaysAgo : baseSince
      try {
        const allRecent = await client.search({ since: recentSince })
        if (Array.isArray(allRecent)) seqs = [...seqs, ...allRecent]
      } catch { /* ignore */ }

      const uniqueSeqs = [...new Set(seqs)]
      result.debug.found_uids = uniqueSeqs.length

      for (const seq of uniqueSeqs) {
        try {
          const msg = await client.fetchOne(String(seq), { source: true })
          if (!msg || !('source' in msg) || !msg.source) continue

          const parsed = await simpleParser(msg.source as Buffer)
          const from    = parsed.from?.text ?? ''
          const subject = parsed.subject ?? ''
          const text    = parsed.text ?? ''
          const html    = (parsed.html as string | false | null | undefined) || ''
          const htmlStripped = typeof html === 'string' ? htmlToText(html) : ''
          // Prefer whichever version carries more booking signal (HTML tables often
          // hold the structured fields that the plain-text part omits).
          const body    = pickRicherBody(text, htmlStripped)

          let platform = 'other'
          for (const [key, domain] of Object.entries(PLATFORM_SENDERS)) {
            if (from.toLowerCase().includes(domain)) { platform = key; break }
          }

          const extracted = await extractBookingWithAI(subject, body, platform, properties, bnbName)
          if (!extracted) { result.debug.ai_null++; continue }
          if (!extracted.is_booking) { result.debug.skipped_not_booking++; continue }

          // Validate the AI-returned id actually exists before trusting it; the model
          // sometimes hallucinates an id that isn't in the room list (→ FK error / wrong room).
          const validMatchedId =
            extracted.matched_property_id && properties.some(p => p.id === extracted.matched_property_id)
              ? extracted.matched_property_id
              : null

          const resolvedPropertyId =
            validMatchedId
            ?? matchPropertyByName(extracted.property_name, properties)
            ?? fallbackPropertyId

          // Validate dates: must be a real YYYY-MM-DD and check_out strictly after check_in
          // (guards against DD/MM vs MM/DD swaps the model occasionally makes).
          const checkIn = isValidYmd(extracted.check_in) ? extracted.check_in : null
          const validCheckOut =
            isValidYmd(extracted.check_out) && checkIn && extracted.check_out > checkIn
              ? extracted.check_out
              : null
          const checkOut = validCheckOut || (checkIn
            ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
            : null)

          if (!checkIn) { result.debug.skipped_no_checkin++; result.processed++; continue }

          const isPartial = !validCheckOut || !extracted.guest_name
          const bookingStatus = extracted.is_cancellation ? 'cancelled' : (isPartial ? 'pending' : 'confirmed')

          const confId = extracted.confirmation_id || `email_${settingId}_${seq}`

          // Duplicate check 1: exact confirmation_id match
          const { data: dupById } = await supabase
            .from('bookings')
            .select('id, status, guest_name, check_out, total_price, num_guests, property_id')
            .eq('user_id', setting.user_id)
            .eq('platform_booking_id', confId)
            .maybeSingle()
          if (dupById) {
            // Cancellation email → mark existing as cancelled.
            if (extracted.is_cancellation && dupById.status !== 'cancelled') {
              await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', dupById.id)
              result.added++
              result.processed++; continue
            }
            // Booking.com two-stage flow: the first (pre-stay) email carries only the
            // order number + check-in; the same-day email fills in guest / check-out /
            // price. Merge newly-available fields into the existing record instead of
            // dropping this richer email as a duplicate.
            const patch: Record<string, unknown> = {}
            if (extracted.guest_name && (!dupById.guest_name || dupById.guest_name === '(待補充)'))
              patch.guest_name = extracted.guest_name
            if (validCheckOut && validCheckOut !== dupById.check_out)
              patch.check_out = validCheckOut
            if (extracted.total_price != null && dupById.total_price == null)
              patch.total_price = extracted.total_price
            if (extracted.num_guests && (dupById.num_guests == null || dupById.num_guests <= 1))
              patch.num_guests = extracted.num_guests
            if (resolvedPropertyId && !dupById.property_id)
              patch.property_id = resolvedPropertyId
            if (Object.keys(patch).length > 0) {
              // Promote pending → confirmed once the full picture has arrived.
              if (!extracted.is_cancellation && dupById.status === 'pending' && !isPartial) {
                patch.status = 'confirmed'
                patch.notes = null
              }
              await supabase.from('bookings').update(patch).eq('id', dupById.id)
              result.added++
            } else {
              result.debug.skipped_duplicate++
            }
            result.processed++; continue
          }

          // Duplicate check 2: same platform + check_in + check_out + guest_name (catches re-imported with different confId)
          let existingId: string | null = null
          if (checkIn && extracted.guest_name && checkOut) {
            const { data: dupByGuest } = await supabase
              .from('bookings')
              .select('id, total_price, platform_booking_id')
              .eq('user_id', setting.user_id)
              .eq('platform', platform)
              .eq('check_in', checkIn)
              .eq('check_out', checkOut)
              .eq('source', 'email')
              .ilike('guest_name', `%${extracted.guest_name.split(/[\s/]/)[0]}%`)
              .maybeSingle()
            if (dupByGuest) {
              existingId = dupByGuest.id
              // If we now have a real confirmation_id but the existing record used a fallback id, update it
              if (extracted.confirmation_id && dupByGuest.platform_booking_id?.startsWith('email_')) {
                await supabase.from('bookings').update({
                  platform_booking_id: extracted.confirmation_id,
                  total_price: extracted.total_price ?? dupByGuest.total_price,
                  status: extracted.is_cancellation ? 'cancelled' : 'confirmed',
                  notes: null,
                }).eq('id', existingId)
              }
              result.debug.skipped_duplicate++; result.processed++; continue
            }
          }

          // Duplicate check 3: same platform + check_in + property (looser, last resort)
          if (checkIn && !existingId) {
            let dupQ = supabase
              .from('bookings')
              .select('id')
              .eq('user_id', setting.user_id)
              .eq('platform', platform)
              .eq('check_in', checkIn)
              .eq('source', 'email')
            if (resolvedPropertyId) dupQ = dupQ.eq('property_id', resolvedPropertyId)
            const { data: dup } = await dupQ.maybeSingle()
            if (dup) { result.debug.skipped_duplicate++; result.processed++; continue }
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
              num_guests:          extracted.num_guests || 1,
              total_price:         extracted.total_price,
              status:              bookingStatus,
              source:              'email',
              notes:               isPartial ? '由 Email 部分擷取，請至平台後台確認完整資料' : null,
              raw_data:            { subject, from, confirmation_id: extracted.confirmation_id, property_name: extracted.property_name },
            }, { onConflict: 'user_id,platform,platform_booking_id' })

          if (bkErr) {
            result.errors.push(`訂單 upsert 失敗: ${bkErr.message}`)
          } else {
            result.added++
          }
          result.processed++
        } catch (e) {
          result.errors.push(`處理郵件 ${seq} 失敗: ${String(e)}`)
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (e) {
    const msg = `IMAP 連線失敗: ${String(e)}`
    result.errors.push(msg)
    await supabase.from('email_settings').update({
      last_sync_error: msg,
      last_synced_at: new Date().toISOString(),
    }).eq('id', settingId)
    return result
  }

  await supabase.from('email_settings').update({
    last_synced_at:  new Date().toISOString(),
    last_sync_count: result.added,
    last_sync_error: result.errors.length > 0 ? result.errors[0] : null,
  }).eq('id', settingId)

  return result
}

export async function syncAllEmailForUser(userId: string) {
  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('email_settings')
    .select('id')
    .eq('user_id', userId)
    .eq('sync_enabled', true)

  if (!settings?.length) return []
  return Promise.all(settings.map((s: { id: string }) => syncEmailForSetting(s.id)))
}

// ── Platform-specific extraction hints (derived from real sample emails) ──
const PLATFORM_HINTS: Record<string, string> = {
  booking_com: `Booking.com：
- 訂單號為純數字 9-10 位，出現在主旨「(數字, 日期)」、內文「Booking information — 數字」「確認訂房編號為 數字」或網址「res_id=數字」。
- 兩段式郵件：入住日前的通知常只有入住/退房日期與訂單號，沒有姓名/房型/金額（正常，is_booking 仍為 true）；入住當天才會有完整房客資訊。
- 日期格式如「2026年6月5日」。`,
  agoda: `Agoda：
- 訂單號為純數字（約 10 位），出現在主旨「Agoda 訂單 數字」或「Agoda Booking ID 數字」、內文「訂房編號」下一行。
- 欄位標籤：訂房編號 / 入住 / 退房 / 房型 / 入住人數 / 房客姓名 / 總金額。
- 主旨含「CANCELLED」或內文「您的訂單已取消」→ is_cancellation true。
- 金額如「TWD 3,600」；房客姓名格式「姓, 名」。`,
  trip_com: `Trip.com：
- 訂單號為純數字（約 16 位），出現在主旨「Booking no.數字」、內文「訂單編號」下一行。
- 欄位標籤：訂單編號 / 入住 / 退房 / 房型 / 住客姓名 / 房間數 / 入住人數 / 總價。
- 主旨「Cancellation request accepted」或內文「訂單已取消」→ is_cancellation true。
- 房客姓名格式「姓/名」。`,
  asiayo: `AsiaYo：
- 訂單號為純數字 12 碼（格式類似 YYYYMMDD+序號，如 202605260319），出現在主旨括號內與內文「訂單編號」下一行。
- 入住/退房日期格式為 YYYY/MM/DD（如 2026/07/10、2026/07/12）。
- 欄位標籤：訂單編號 / 入住日期 / 退房日期 / 房型 / 住客姓名（格式「名 姓」）/ 入住人數（大人＋小孩）/ 訂單金額。`,
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

// ── AI Extraction ─────────────────────────────────────────────

async function extractBookingWithAI(
  subject: string,
  body: string,
  platform: string,
  properties: UserProperty[],
  bnbName: string | null
): Promise<BookingExtracted | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const isDeepSeek = !!process.env.DEEPSEEK_API_KEY
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

  const prompt = `從以下訂房平台郵件中擷取訂單資訊，回傳 JSON 格式。
${bnbLine}
郵件主旨：${subject}
平台：${platform}
郵件內容：
${truncatedBody}
${roomListStr}${hint}${preLine}

通用注意：
- confirmation_id 務必從主旨或內文找出；純數字平台不要把電話、金額、日期數字當成訂單號。
- 日期一律輸出 YYYY-MM-DD；中文「2026年6月5日」要轉成「2026-06-05」；退房日必須晚於入住日。
- 無法確定的欄位填 null，不要猜測。
- 取消類郵件 is_cancellation 設 true，但 is_booking 仍為 true。

請回傳以下 JSON（無法確定的欄位填 null，不要猜測）：
{
  "is_booking": true 或 false（是否為訂房確認/取消郵件）,
  "is_cancellation": true 或 false,
  "guest_name": "旅客姓名，無法取得填 null",
  "check_in": "YYYY-MM-DD，入住日期",
  "check_out": "YYYY-MM-DD，退房日期，無法取得填 null",
  "confirmation_id": "訂單確認號/預約編號",
  "total_price": 數字或null,
  "num_guests": 數字或null,
  "property_name": "郵件中出現的房型名稱（如：標準雙人房、Standard Double Room），無房型資訊填 null",
  "matched_property_id": "從已知房型清單中最符合的 id，若無法確定則為 null",
  "platform": "${platform}"
}

只回傳 JSON，不要其他說明。`

  try {
    let responseText: string

    if (isDeepSeek) {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json()
      responseText = data.choices?.[0]?.message?.content ?? ''
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json()
      responseText = data.content?.[0]?.text ?? ''
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as BookingExtracted
    // Fall back to the regex-detected order number when the model missed it.
    if (!parsed.confirmation_id && pre.confirmation_id) parsed.confirmation_id = pre.confirmation_id
    return parsed
  } catch {
    return null
  }
}
