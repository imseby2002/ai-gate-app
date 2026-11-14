// 用客人已核對過的身份（訂單號碼／訂房手機／核對過的姓名）到訂房系統（bookings）查實際住宿晚數。
// 連續的訂單（前一筆退房日＝下一筆入住日、同一位旅客）合併計算，涵蓋「續住」。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any

export interface VerifiedStay { nights: number; checkIn: string; checkOut: string }

const DAY = 86_400_000
const normName = (s?: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, '')
const nameKeys = (s?: string | null) => {
  const parts = (s ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  return new Set([parts.join(''), [...parts].reverse().join('')])
}

export async function getVerifiedStayNights(supabase: Supa, userId: string, facts?: Record<string, unknown> | null): Promise<VerifiedStay | null> {
  if (!facts) return null
  const orderNumber = String(facts.orderNumber ?? '').trim()
  const phone = String(facts.phone ?? '').replace(/\D/g, '')
  const confirmedName = String(facts.confirmedName ?? '').trim()
  if (!orderNumber && phone.length < 8 && !confirmedName) return null

  const since = new Date(Date.now() - 2 * DAY).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const { data } = await supabase
    .from('bookings')
    .select('guest_name, guest_phone, platform_booking_id, check_in, check_out, status')
    .eq('user_id', userId)
    .gte('check_out', since)
    .order('check_in', { ascending: true })
    .limit(500)
  const rows = ((data ?? []) as Array<{ guest_name: string | null; guest_phone: string | null; platform_booking_id: string | null; check_in: string; check_out: string; status: string | null }>)
    .filter(r => r.status !== 'cancelled' && r.check_in && r.check_out)

  const wantName = confirmedName ? nameKeys(confirmedName) : null
  const seed = rows.find(r =>
    (orderNumber && r.platform_booking_id === orderNumber)
    || (phone.length >= 8 && (r.guest_phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-9)))
    || (wantName && [...nameKeys(r.guest_name)].some(k => wantName.has(k))))
  if (!seed) return null

  const sameGuest = rows.filter(r => normName(r.guest_name) && [...nameKeys(r.guest_name)].some(k => nameKeys(seed.guest_name).has(k)))
  let checkIn = seed.check_in
  let checkOut = seed.check_out
  for (let changed = true; changed;) {
    changed = false
    for (const r of sameGuest) {
      if (r.check_in === checkOut && r.check_out > checkOut) { checkOut = r.check_out; changed = true }
      if (r.check_out === checkIn && r.check_in < checkIn) { checkIn = r.check_in; changed = true }
    }
  }
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY)
  return nights > 0 ? { nights, checkIn, checkOut } : null
}

// 這位旅客在訂房系統的入住次數（同一旅客連續的訂單算同一次入住；已取消不算）。用來判斷回訪客人。
export async function countGuestStays(supabase: Supa, userId: string, facts?: Record<string, unknown> | null): Promise<number> {
  if (!facts) return 0
  const orderNumber = String(facts.orderNumber ?? '').trim()
  const phone = String(facts.phone ?? '').replace(/\D/g, '')
  const confirmedName = String(facts.confirmedName ?? '').trim()
  if (!orderNumber && phone.length < 8 && !confirmedName) return 0
  const { data } = await supabase
    .from('bookings')
    .select('guest_name, guest_phone, platform_booking_id, check_in, check_out, status')
    .eq('user_id', userId)
    .order('check_in', { ascending: true })
    .limit(5000)
  const rows = ((data ?? []) as Array<{ guest_name: string | null; guest_phone: string | null; platform_booking_id: string | null; check_in: string; check_out: string; status: string | null }>)
    .filter(r => r.status !== 'cancelled' && r.check_in && r.check_out)
  const wantName = confirmedName ? nameKeys(confirmedName) : null
  const seed = rows.find(r =>
    (orderNumber && r.platform_booking_id === orderNumber)
    || (phone.length >= 8 && (r.guest_phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-9)))
    || (wantName && [...nameKeys(r.guest_name)].some(k => wantName.has(k))))
  if (!seed || !normName(seed.guest_name)) return seed ? 1 : 0
  const seedKeys = nameKeys(seed.guest_name)
  const mine = rows.filter(r => [...nameKeys(r.guest_name)].some(k => seedKeys.has(k)))
  let stays = 0
  let lastOut = ''
  for (const r of mine) {
    if (r.check_in !== lastOut && r.check_in > lastOut) stays++
    if (r.check_out > lastOut) lastOut = r.check_out
  }
  return stays
}

export interface GuestBooking {
  id: string
  guestName: string | null
  checkIn: string
  checkOut: string
  room: string | null
  orderNo: string | null
  guests: number | null
  platform: string | null
}

// 收件匣客人摘要用：依客人已核對的身份（訂單號碼／手機／姓名）找訂房系統中最相關的一筆訂單
// （進行中或即將入住優先）。身份都沒有時，退而用 LINE 顯示名稱比對，但只在恰好一位旅客符合時採用，避免同名誤配。
export async function findGuestBooking(supabase: Supa, userId: string, facts?: Record<string, unknown> | null, displayName?: string | null): Promise<GuestBooking | null> {
  const orderNumber = String(facts?.orderNumber ?? '').trim()
  const phone = String(facts?.phone ?? '').replace(/\D/g, '')
  const confirmedName = String(facts?.confirmedName ?? '').trim()

  const since = new Date(Date.now() - 2 * DAY).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const { data } = await supabase
    .from('bookings')
    .select('id, guest_name, guest_phone, platform, platform_booking_id, check_in, check_out, num_guests, status, property_id')
    .eq('user_id', userId)
    .gte('check_out', since)
    .order('check_in', { ascending: true })
    .limit(500)
  type Row = { id: string; guest_name: string | null; guest_phone: string | null; platform: string | null; platform_booking_id: string | null; check_in: string; check_out: string; num_guests: number | null; status: string | null; property_id: string | null }
  const rows = ((data ?? []) as Row[]).filter(r => r.status !== 'cancelled' && r.check_in && r.check_out)

  let hit: Row | undefined
  if (orderNumber) hit = rows.find(r => r.platform_booking_id === orderNumber)
  if (!hit && phone.length >= 8) hit = rows.find(r => (r.guest_phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-9)))
  const nameHit = (n: string) => {
    const want = nameKeys(n)
    const ms = rows.filter(r => normName(r.guest_name) && [...nameKeys(r.guest_name)].some(k => want.has(k)))
    return new Set(ms.map(r => normName(r.guest_name))).size === 1 ? ms[0] : undefined
  }
  if (!hit && confirmedName) hit = nameHit(confirmedName)
  if (!hit && displayName && normName(displayName).length >= 2) hit = nameHit(displayName)
  if (!hit) return null

  // 同一張訂單訂多間房（訂房系統每間房一筆）→ 房間名稱合併顯示
  const seed = hit
  const siblings = rows.filter(r => seed.platform_booking_id
    ? r.platform_booking_id === seed.platform_booking_id && r.check_in === seed.check_in
    : r.id === seed.id)
  const propIds = [...new Set(siblings.map(r => r.property_id).filter((x): x is string => !!x))]
  let room: string | null = null
  if (propIds.length) {
    const { data: ps } = await supabase.from('properties').select('id, name').in('id', propIds)
    const names = new Map(((ps ?? []) as Array<{ id: string; name: string | null }>).map(p => [p.id, p.name]))
    room = propIds.map(id => names.get(id)).filter(Boolean).join('、') || null
  }
  const guestName = hit.guest_name && !/^[(（]/.test(hit.guest_name.trim()) ? hit.guest_name : null
  return {
    id: hit.id, guestName, checkIn: hit.check_in, checkOut: hit.check_out, room,
    orderNo: hit.platform_booking_id, guests: siblings.reduce((n, r) => n + (r.num_guests ?? 0), 0) || null, platform: hit.platform,
  }
}
