/**
 * 依歷史業績＋假日估算人數需求
 * POST /api/shift/needs/estimate  body: { store, from, to, apply? }
 * apply=true：把估算結果存成這段期間「指定日期」的需求（取代同期間先前的估算，不動人工設定）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { isDate } from '@/lib/shift/time'
import { loadSettings } from '@/lib/shift/settings'
import { estimateNeeds } from '@/lib/shift/estimate'

export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim(), from = String(b.from ?? ''), to = String(b.to ?? '')
  if (!store || !isDate(from) || !isDate(to) || to < from) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 30) return NextResponse.json({ error: '一次最多 31 天' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { merged } = await loadSettings(ctx.admin, ctx.ownerId, store)
  const est = await estimateNeeds(ctx.admin, ctx.ownerId, store, from, to, merged)
  if (!b.apply) return NextResponse.json({ ...est, settings: { cupsPerStaffHour: merged.cupsPerStaffHour, minStaff: merged.minStaff, maxStaff: merged.maxStaff, openStart: merged.openStart, openEnd: merged.openEnd } })

  const rows = est.days.flatMap(d => d.ranges.map(r => ({
    owner_id: ctx.ownerId, store, weekdays: [], start_min: r.start_min, end_min: r.end_min, headcount: r.headcount,
    start_date: d.date, end_date: d.date, note: d.holiday ? `估算（${d.holiday}）` : '估算', source: 'estimate',
  })))
  await ctx.admin.from('shift_needs').delete().eq('owner_id', ctx.ownerId).eq('store', store).eq('source', 'estimate')
    .gte('start_date', from).lte('end_date', to)
  if (rows.length) {
    const { error } = await ctx.admin.from('shift_needs').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: rows.length, days: est.days.length })
}
