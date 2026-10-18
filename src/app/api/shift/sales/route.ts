import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { hourlyProfile, parseSalesRow } from '@/lib/shift/sales'
import { addDays } from '@/lib/shift/time'
import { todayVN } from '@/lib/shift/rules'

// 近 8 週「星期 × 小時」平均業績。?store=
export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const store = (req.nextUrl.searchParams.get('store') ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await hourlyProfile(ctx.admin, ctx.ownerId, store, addDays(todayVN(), 1)))
}

// 匯入每小時業績（同日同小時覆寫）。body: { store, rows: [{ date, hour, orders, cups, revenue }] }
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows: Record<string, unknown>[] = Array.isArray(b.rows) ? b.rows.slice(0, 20000) : []
  const errors: { line: number; reason: string }[] = []
  const merged = new Map<string, { sale_date: string; hour: number; orders: number; cups: number; revenue: number }>()
  rows.forEach((r, i) => {
    const p = parseSalesRow(r)
    if ('error' in p) { errors.push({ line: i + 2, reason: p.error! }); return }
    // 同一檔內同日同小時加總（例：POS 明細逐筆匯出）
    const k = `${p.row.sale_date}|${p.row.hour}`
    const cur = merged.get(k)
    if (cur) { cur.orders += p.row.orders; cur.cups += p.row.cups; cur.revenue += p.row.revenue }
    else merged.set(k, { ...p.row })
  })
  const list = [...merged.values()].map(r => ({ owner_id: ctx.ownerId, store, ...r, updated_at: new Date().toISOString() }))
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await ctx.admin.from('store_hourly_sales').upsert(list.slice(i, i + 500), { onConflict: 'owner_id,store,sale_date,hour' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }
  return NextResponse.json({ imported: list.length, errors })
}
