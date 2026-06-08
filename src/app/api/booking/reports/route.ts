import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp   = req.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))

  const from = `${year}-01-01`
  const to   = `${year}-12-31`

  const [{ data: bookings, error }, { data: cancelledData }, { data: properties }] = await Promise.all([
    supabase
      .from('bookings')
      .select('check_in, check_out, total_price, currency, platform, property_id, status, properties(name)')
      .eq('user_id', ctx.ownerId).gte('check_in', from).lte('check_in', to).neq('status', 'cancelled'),
    supabase
      .from('bookings').select('id')
      .eq('user_id', ctx.ownerId).gte('check_in', from).lte('check_in', to).eq('status', 'cancelled'),
    supabase
      .from('properties').select('room_count').eq('user_id', ctx.ownerId).eq('status', 'active'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = bookings ?? []
  const cancelledCount = cancelledData?.length ?? 0
  const totalRooms = (properties ?? []).reduce((s, p) => s + (p.room_count ?? 1), 0)

  // ── Monthly aggregation ──────────────────────────────────
  const monthly: { month: string; revenue: number; nights: number; bookings: number; occupancyRate: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const label = `${m}月`
    let revenue = 0; let nights = 0; let cnt = 0
    for (const b of rows) {
      const bMonth = parseInt(b.check_in.slice(5, 7))
      if (bMonth !== m) continue
      revenue += Number(b.total_price ?? 0)
      const ci = new Date(b.check_in); const co = new Date(b.check_out)
      nights += Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
      cnt++
    }
    const daysInMonth = new Date(year, m, 0).getDate()
    const availableNights = totalRooms * daysInMonth
    const occupancyRate = availableNights > 0 ? Math.round(nights / availableNights * 100) : 0
    monthly.push({ month: label, revenue, nights, bookings: cnt, occupancyRate })
  }

  // ── Platform breakdown ──────────────────────────────────
  const platformMap: Record<string, { revenue: number; bookings: number }> = {}
  for (const b of rows) {
    const p = b.platform ?? 'other'
    if (!platformMap[p]) platformMap[p] = { revenue: 0, bookings: 0 }
    platformMap[p].revenue  += Number(b.total_price ?? 0)
    platformMap[p].bookings += 1
  }
  const byPlatform = Object.entries(platformMap).map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── Room type breakdown ──────────────────────────────────
  const roomMap: Record<string, { name: string; revenue: number; bookings: number }> = {}
  for (const b of rows) {
    const pid  = b.property_id ?? 'unknown'
    const pname = (b.properties as unknown as { name: string } | null)?.name ?? '未指定'
    if (!roomMap[pid]) roomMap[pid] = { name: pname, revenue: 0, bookings: 0 }
    roomMap[pid].revenue  += Number(b.total_price ?? 0)
    roomMap[pid].bookings += 1
  }
  const byRoom = Object.values(roomMap).sort((a, b) => b.revenue - a.revenue)

  // ── Totals ──────────────────────────────────────────────
  const totalRevenue  = rows.reduce((s, b) => s + Number(b.total_price ?? 0), 0)
  const totalNights   = rows.reduce((s, b) => {
    const ci = new Date(b.check_in); const co = new Date(b.check_out)
    return s + Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
  }, 0)
  const totalBookings = rows.length
  const avgPrice      = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0
  const avgStay       = totalBookings > 0 ? Math.round(totalNights / totalBookings * 10) / 10 : 0
  const cancelRate    = (totalBookings + cancelledCount) > 0
    ? Math.round(cancelledCount / (totalBookings + cancelledCount) * 100) : 0
  const daysInYear    = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
  const availableTotal = totalRooms * daysInYear
  const occupancyRate = availableTotal > 0 ? Math.round(totalNights / availableTotal * 100) : 0
  const revPAR        = availableTotal > 0 ? Math.round(totalRevenue / availableTotal) : 0

  return NextResponse.json({ monthly, byPlatform, byRoom, totalRevenue, totalNights, totalBookings, avgPrice, avgStay, cancelRate, cancelledCount, occupancyRate, revPAR, year })
}
