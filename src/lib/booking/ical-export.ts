// 把房型的「已佔用日期」組成一份 iCal (.ics)，供各訂房平台（OTA）訂閱後自動關房。
// 來源：正式訂單 bookings、官網訂房 public_bookings（皆取 pending/confirmed），以及房東手動關房 blocked_dates。

type SupabaseAny = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

interface Range { start: string; end: string; uid: string; summary: string }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: string) => d.replace(/-/g, '') // 2026-12-30 -> 20261230
function addDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
// iCal 文字轉義：逗號、分號、反斜線要加跳脫，換行用 \n
function esc(s: string): string {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
// 超過 75 字元的行要折行（RFC 5545）：每 74 字元切一段，續行以一個空白開頭
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 0) { parts.push(' ' + rest.slice(0, 73)); rest = rest.slice(73) }
  return parts.join('\r\n')
}

export async function buildPropertyICal(
  supabase: SupabaseAny,
  property: { id: string; user_id: string; name: string },
): Promise<string> {
  const uid = property.id.replace(/-/g, '')
  const [{ data: bk }, { data: pub }, { data: blk }] = await Promise.all([
    supabase.from('bookings').select('id, check_in, check_out, guest_name')
      .eq('user_id', property.user_id).eq('property_id', property.id).in('status', ['pending', 'confirmed']),
    supabase.from('public_bookings').select('id, check_in, check_out')
      .eq('host_user_id', property.user_id).eq('property_id', property.id).in('status', ['pending', 'confirmed']),
    supabase.from('blocked_dates').select('id, date')
      .eq('user_id', property.user_id).eq('property_id', property.id).eq('reason', 'owner_block'),
  ])

  const ranges: Range[] = []
  for (const b of (bk ?? [])) {
    if (!b.check_in || !b.check_out) continue
    ranges.push({ start: b.check_in, end: b.check_out, uid: `bk-${b.id}@${uid}`, summary: '已訂房' })
  }
  for (const b of (pub ?? [])) {
    if (!b.check_in || !b.check_out) continue
    ranges.push({ start: b.check_in, end: b.check_out, uid: `pb-${b.id}@${uid}`, summary: '已訂房' })
  }
  for (const b of (blk ?? [])) {
    if (!b.date) continue
    ranges.push({ start: b.date, end: addDay(b.date), uid: `bl-${b.id}@${uid}`, summary: '關房' })
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//im-tourist//booking//ZH`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(property.name)}`),
  ]
  for (const r of ranges) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(r.start)}`,
      `DTEND;VALUE=DATE:${ymd(r.end)}`,
      fold(`SUMMARY:${esc(r.summary)}`),
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

export function propertyIcalUrl(domain: string, token: string): string {
  return `${domain}/api/booking/ical/feed?token=${token}`
}
