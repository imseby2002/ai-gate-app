/**
 * 假日／特殊日（全公司共用；估算人數需求與 AI 排班會參考）
 * GET    ?from=&to=（預設今年）
 * POST   { date, name } 新增；或 { seedYear } 加入越南法定固定日期國定假日
 * DELETE { id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext } from '@/lib/shift/scope'
import { isDate } from '@/lib/shift/time'
import { vnFixedHolidays } from '@/lib/shift/settings'
import type { UnitContext } from '@/lib/auth/unit-access'

const deny = (ctx: UnitContext) => NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const sp = req.nextUrl.searchParams
  const y = new Date().getFullYear()
  const from = isDate(sp.get('from')) ? sp.get('from')! : `${y}-01-01`
  const to = isDate(sp.get('to')) ? sp.get('to')! : `${y + 1}-12-31`
  const { data, error } = await ctx.admin.from('shift_holidays').select('id, date, name').eq('owner_id', ctx.ownerId).gte('date', from).lte('date', to).order('date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holidays: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const b = await req.json().catch(() => ({}))
  const rows = b.seedYear
    ? vnFixedHolidays(Math.round(Number(b.seedYear)))
    : [{ date: String(b.date ?? ''), name: String(b.name ?? '').trim().slice(0, 80) }]
  if (!rows.every(r => isDate(r.date))) return NextResponse.json({ error: '日期錯誤' }, { status: 400 })
  const { error } = await ctx.admin.from('shift_holidays')
    .upsert(rows.map(r => ({ owner_id: ctx.ownerId, ...r })), { onConflict: 'owner_id,date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, saved: rows.length })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await ctx.admin.from('shift_holidays').delete().eq('id', String(id)).eq('owner_id', ctx.ownerId)
  return NextResponse.json({ ok: true })
}
