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
  '訂房確認', '預訂確認', '預約確認', '訂單確認', '確認通知',
  '入住確認', '訂房成功', '預訂成功',
  '取消確認', '取消通知', '訂單取消',
  'booking confirmation', 'reservation confirmed', 'confirmed booking',
  'reservation confirmation', 'booking confirmed',
  'cancellation confirmation', 'booking cancelled',
  'new reservation', 'new booking',
  'itinerary', '行程確認',
]

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
  const result: EmailSyncResult = { processed: 0, added: 0, errors: [] }

  const { data: setting, error: se } = await supabase
    .from('email_settings')
    .select('*')
    .eq('id', settingId)
    .single()

  if (se || !setting) {
    result.errors.push(`找不到設定：${settingId}`)
    return result
  }

  // Load ALL user properties (rooms) for name-based matching
  const { data: userProperties } = await supabase
    .from('properties')
    .select('id, name, name_aliases')
    .eq('user_id', setting.user_id)
    .eq('status', 'active')

  const properties: UserProperty[] = userProperties ?? []

  // Load B&B profile for context (name used in AI prompt)
  const { data: bnbProfile } = await supabase
    .from('bnb_profiles')
    .select('name')
    .eq('user_id', setting.user_id)
    .maybeSingle()

  const bnbName = bnbProfile?.name ?? null

  // Fallback: if only one room exists, use it
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
      const sinceDate = setting.last_synced_at
        ? new Date(setting.last_synced_at)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      let uids: number[] = []

      // Strategy 1: search by known sender domains
      for (const domain of Object.values(PLATFORM_SENDERS)) {
        try {
          const found = await client.search({ from: `@${domain}`, since: sinceDate })
          if (Array.isArray(found)) uids = [...uids, ...found]
        } catch { /* some servers don't support all search criteria */ }
      }

      // Strategy 2: search by subject keywords (catches unlisted platforms)
      for (const kw of BOOKING_SUBJECT_KEYWORDS) {
        try {
          const found = await client.search({ subject: kw, since: sinceDate })
          if (Array.isArray(found)) uids = [...uids, ...found]
        } catch { /* keyword search may not be supported */ }
      }

      const uniqueUids = [...new Set(uids)]

      for (const uid of uniqueUids) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true })
          if (!msg || !('source' in msg) || !msg.source) continue

          const parsed = await simpleParser(msg.source as Buffer)
          const from    = parsed.from?.text ?? ''
          const subject = parsed.subject ?? ''
          const text    = parsed.text ?? ''
          const html    = (parsed.html as string | false | null | undefined) || ''
          const body    = text || (typeof html === 'string' ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : '')

          // Detect platform from sender domain
          let platform = 'other'
          for (const [key, domain] of Object.entries(PLATFORM_SENDERS)) {
            if (from.toLowerCase().includes(domain)) { platform = key; break }
          }

          // AI extraction — pass B&B name + room list for identification
          const extracted = await extractBookingWithAI(subject, body, platform, properties, bnbName)
          if (!extracted?.is_booking) continue

          // Resolve property_id: AI match > fallback setting > null
          const resolvedPropertyId =
            extracted.matched_property_id
            ?? matchPropertyByName(extracted.property_name, properties)
            ?? fallbackPropertyId

          // Booking.com emails often lack check_out/guest_name — use placeholders
          const checkIn  = extracted.check_in
          const checkOut = extracted.check_out || (checkIn
            ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
            : null)

          // Must have at minimum a check_in date
          if (!checkIn) { result.processed++; continue }

          const isPartial = !extracted.check_out || !extracted.guest_name
          const bookingStatus = extracted.is_cancellation ? 'cancelled' : (isPartial ? 'pending' : 'confirmed')

          // Skip if already imported (same property + platform + confirmation OR dates)
          const confId = extracted.confirmation_id || `email_${settingId}_${uid}`
          if (extracted.check_in) {
            let dupQ = supabase
              .from('bookings')
              .select('id')
              .eq('user_id', setting.user_id)
              .eq('platform', platform)
              .eq('check_in', checkIn)
            if (resolvedPropertyId) dupQ = dupQ.eq('property_id', resolvedPropertyId)
            const { data: dup } = await dupQ.maybeSingle()
            if (dup) { result.processed++; continue }
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
          result.errors.push(`處理郵件 ${uid} 失敗: ${String(e)}`)
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
  const truncatedBody = body.slice(0, 3000)

  const bnbLine = bnbName ? `\n此民宿名稱（所有訂單都屬於此民宿）：${bnbName}` : ''
  const roomListStr = properties.length > 0
    ? `\n已知房型清單（請判斷是哪個房型，回傳其 id）：\n${properties.map(p => {
        const aliases = (p.name_aliases ?? []).length > 0 ? `，別名：${p.name_aliases.join('、')}` : ''
        return `- id: "${p.id}", 房型名稱: "${p.name}"${aliases}`
      }).join('\n')}`
    : ''

  const prompt = `從以下訂房平台郵件中擷取訂單資訊，回傳 JSON 格式。
${bnbLine}
郵件主旨：${subject}
平台：${platform}
郵件內容：
${truncatedBody}
${roomListStr}

注意：Booking.com 的通知郵件通常只含訂單號與入住日期，沒有退房日、姓名、房型，這是正常現象，仍請回傳 is_booking: true 並盡量擷取可用欄位。

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
          max_tokens: 600,
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
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json()
      responseText = data.content?.[0]?.text ?? ''
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0]) as BookingExtracted
  } catch {
    return null
  }
}
