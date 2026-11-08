import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

type Row = {
  check_in: string; check_out: string; total_price: number | null
  currency: string | null; platform: string | null; property_id: string | null
  status: string; properties: { name: string } | null
}

const nightsOf = (ci: string, co: string) =>
  Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp    = req.nextUrl.searchParams
  const year  = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const monthParam = sp.get('month')
  const month = monthParam ? Math.min(12, Math.max(1, parseInt(monthParam))) : null

  const { data: properties } = await supabase
    .from('properties').select('room_count').eq('user_id', ctx.ownerId).eq('status', 'active')
  const totalRooms = (properties ?? []).reduce((s: number, p: { room_count: number | null }) => s + (p.room_count ?? 1), 0)

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthRange = (y: number, m: number) => ({ from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` })

  async function fetchRows(from: string, to: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('check_in, check_out, total_price, currency, platform, property_id, status, properties(name)')
      .eq('user_id', ctx!.ownerId).gte('check_in', from).lte('check_in', to).neq('status', 'cancelled')
    return { rows: (data ?? []) as unknown as Row[], error }
  }
  async function cancelledCount(from: string, to: string) {
    const { data } = await supabase
      .from('bookings').select('id')
      .eq('user_id', ctx!.ownerId).gte('check_in', from).lte('check_in', to).eq('status', 'cancelled')
    return data?.length ?? 0
  }
  const revenueOf = (rows: Row[]) => rows.reduce((s, b) => s + Number(b.total_price ?? 0), 0)

  function breakdowns(rows: Row[]) {
    const platformMap: Record<string, { revenue: number; bookings: number }> = {}
    const roomMap: Record<string, { name: string; revenue: number; bookings: number }> = {}
    for (const b of rows) {
      const p = b.platform ?? 'other'
      if (!platformMap[p]) platformMap[p] = { revenue: 0, bookings: 0 }
      platformMap[p].revenue += Number(b.total_price ?? 0); platformMap[p].bookings += 1
      const pid = b.property_id ?? 'unknown'
      const pname = b.properties?.name ?? '未指定'
      if (!roomMap[pid]) roomMap[pid] = { name: pname, revenue: 0, bookings: 0 }
      roomMap[pid].revenue += Number(b.total_price ?? 0); roomMap[pid].bookings += 1
    }
    const byPlatform = Object.entries(platformMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue)
    const byRoom = Object.values(roomMap).sort((a, b) => b.revenue - a.revenue)
    return { byPlatform, byRoom }
  }

  function totals(rows: Row[], cancelled: number, availableNights: number) {
    const totalRevenue  = revenueOf(rows)
    const totalNights   = rows.reduce((s, b) => s + nightsOf(b.check_in, b.check_out), 0)
    const totalBookings = rows.length
    const avgPrice      = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0
    const avgStay       = totalBookings > 0 ? Math.round(totalNights / totalBookings * 10) / 10 : 0
    const cancelRate    = (totalBookings + cancelled) > 0 ? Math.round(cancelled / (totalBookings + cancelled) * 100) : 0
    const occupancyRate = availableNights > 0 ? Math.round(totalNights / availableNights * 100) : 0
    const revPAR        = availableNights > 0 ? Math.round(totalRevenue / availableNights) : 0
    return { totalRevenue, totalNights, totalBookings, avgPrice, avgStay, cancelRate, cancelledCount: cancelled, occupancyRate, revPAR }
  }

  // ── Single-month detail ──────────────────────────────────
  if (month) {
    const { from, to } = monthRange(year, month)
    const daysInMonth = new Date(year, month, 0).getDate()
    const [{ rows, error }, cancelled] = await Promise.all([fetchRows(from, to), cancelledCount(from, to)])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 以入住日歸戶的每日營收／訂單；住房率則以「當晚實際佔用房數」計（跨日住宿每一晚都算）
    const daily: { day: number; date: string; revenue: number; bookings: number; nights: number; occupancyRate: number }[] = []
    const occByDay = new Array(daysInMonth + 1).fill(0)
    for (const b of rows) {
      const ci = new Date(`${b.check_in}T00:00:00`); const co = new Date(`${b.check_out}T00:00:00`)
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() + 1 === month) occByDay[d.getDate()] += 1
      }
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`
      let revenue = 0; let bookings = 0
      for (const b of rows) {
        if (b.check_in !== dateStr) continue
        revenue += Number(b.total_price ?? 0); bookings += 1
      }
      const nights = occByDay[d]
      const occupancyRate = totalRooms > 0 ? Math.round(nights / totalRooms * 100) : 0
      daily.push({ day: d, date: `${month}/${d}`, revenue, bookings, nights, occupancyRate })
    }

    const t = totals(rows, cancelled, totalRooms * daysInMonth)
    const { byPlatform, byRoom } = breakdowns(rows)

    // 環比（上月）與年比（去年同月）— 僅比交易額
    const prevY = month === 1 ? year - 1 : year
    const prevM = month === 1 ? 12 : month - 1
    const prevRange = monthRange(prevY, prevM)
    const yoyRange  = monthRange(year - 1, month)
    const [{ rows: prevRows }, { rows: yoyRows }] = await Promise.all([
      fetchRows(prevRange.from, prevRange.to), fetchRows(yoyRange.from, yoyRange.to),
    ])
    const prevRevenue = revenueOf(prevRows)
    const yoyRevenue  = revenueOf(yoyRows)
    const pct = (cur: number, base: number) => base > 0 ? Math.round((cur - base) / base * 1000) / 10 : null
    const momPct = pct(t.totalRevenue, prevRevenue)
    const yoyPct = pct(t.totalRevenue, yoyRevenue)

    return NextResponse.json({ mode: 'month', year, month, daily, byPlatform, byRoom, ...t, prevRevenue, yoyRevenue, momPct, yoyPct })
  }

  // ── Full year (default) ──────────────────────────────────
  const { from, to } = { from: `${year}-01-01`, to: `${year}-12-31` }
  const [{ rows, error }, cancelled] = await Promise.all([fetchRows(from, to), cancelledCount(from, to)])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const monthly: { month: string; revenue: number; nights: number; bookings: number; occupancyRate: number }[] = []
  for (let m = 1; m <= 12; m++) {
    let revenue = 0; let nights = 0; let cnt = 0
    for (const b of rows) {
      if (parseInt(b.check_in.slice(5, 7)) !== m) continue
      revenue += Number(b.total_price ?? 0); nights += nightsOf(b.check_in, b.check_out); cnt++
    }
    const availableNights = totalRooms * new Date(year, m, 0).getDate()
    monthly.push({ month: `${m}月`, revenue, nights, bookings: cnt, occupancyRate: availableNights > 0 ? Math.round(nights / availableNights * 100) : 0 })
  }

  const { byPlatform, byRoom } = breakdowns(rows)
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
  const t = totals(rows, cancelled, totalRooms * daysInYear)

  return NextResponse.json({ mode: 'year', year, monthly, byPlatform, byRoom, ...t })
}
