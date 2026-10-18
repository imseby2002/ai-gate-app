import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { parseHHMM, SLOT_MIN } from '@/lib/shift/time'

// 門市人力需求：某些星期幾的某段時間需要幾個人。body: { store, weekdays: number[]（空＝每天）, start: "HH:MM", end: "HH:MM", headcount }
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const start_min = parseHHMM(b.start), end_min = parseHHMM(b.end)
  const headcount = Math.round(Number(b.headcount))
  if (start_min == null || end_min == null || end_min <= start_min || start_min % SLOT_MIN || end_min % SLOT_MIN) return NextResponse.json({ error: '時間錯誤（結束需晚於開始）' }, { status: 400 })
  if (!Number.isFinite(headcount) || headcount < 0 || headcount > 50) return NextResponse.json({ error: '人數錯誤' }, { status: 400 })
  const raw: unknown[] = Array.isArray(b.weekdays) ? b.weekdays : []
  const weekdays = [...new Set(raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
  const { data, error } = await ctx.admin.from('shift_needs')
    .insert({ owner_id: ctx.ownerId, store, weekdays, start_min, end_min, headcount }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ need: data })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { id } = await req.json().catch(() => ({}))
  const { data: cur } = await ctx.admin.from('shift_needs').select('id, store').eq('id', String(id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!cur || !storeAllowed(ctx, cur.store)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await ctx.admin.from('shift_needs').delete().eq('id', cur.id)
  return NextResponse.json({ ok: true })
}

// 整批取代門市人力需求（例：套用 AI 依業績建議的需求）。body: { store, items: [{ weekdays, start_min, end_min, headcount }] }
export async function PUT(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const items: Record<string, unknown>[] = Array.isArray(b.items) ? b.items.slice(0, 100) : []
  const rows = items.map(n => {
    const raw: unknown[] = Array.isArray(n.weekdays) ? n.weekdays : []
    return {
      owner_id: ctx.ownerId, store,
      weekdays: [...new Set(raw.map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort(),
      start_min: Number(n.start_min), end_min: Number(n.end_min), headcount: Math.round(Number(n.headcount)),
    }
  }).filter(n => Number.isInteger(n.start_min) && Number.isInteger(n.end_min) && n.start_min >= 0 && n.end_min <= 1440 && n.end_min > n.start_min
    && n.start_min % SLOT_MIN === 0 && n.end_min % SLOT_MIN === 0 && n.headcount >= 0 && n.headcount <= 50)
  if (rows.length === 0) return NextResponse.json({ error: '沒有可套用的需求' }, { status: 400 })
  await ctx.admin.from('shift_needs').delete().eq('owner_id', ctx.ownerId).eq('store', store)
  const { error } = await ctx.admin.from('shift_needs').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: rows.length })
}
