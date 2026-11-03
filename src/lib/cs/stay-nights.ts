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
