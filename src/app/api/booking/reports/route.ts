import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp   = req.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))

  const from = `${year}-01-01`
  const to   = `${year}-12-31`

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('check_in, check_out, total_price, currency, platform, property_id, status, properties(name)')
    .eq('user_id', user.id)
    .gte('check_in', from)
    .lte('check_in', to)
    .neq('status', 'cancelled')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = bookings ?? []

  // ── Monthly aggregation ──────────────────────────────────
  const monthly: { month: string; revenue: number; nights: number; bookings: number }[] = []
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
    monthly.push({ month: label, revenue, nights, bookings: cnt })
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

  return NextResponse.json({ monthly, byPlatform, byRoom, totalRevenue, totalNights, totalBookings, avgPrice, year })
}
