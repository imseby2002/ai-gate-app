import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { pgQuote } from '@/lib/shift/staff'
import { isDate } from '@/lib/shift/time'

// 店長排班總表：門市員工、可上班規則、人力需求、班表。?store=&from=&to=（最多 31 天）
export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const sp = req.nextUrl.searchParams
  const store = (sp.get('store') ?? '').trim(), from = sp.get('from') ?? '', to = sp.get('to') ?? ''
  if (!store || !isDate(from) || !isDate(to) || to < from) return NextResponse.json({ error: 'store / from / to required' }, { status: 400 })
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 31) return NextResponse.json({ error: 'range too long' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = ctx.admin, owner = ctx.ownerId

  const [{ data: emps }, { data: rules }, { data: plans }, { data: needs }] = await Promise.all([
    db.from('hr_employees').select('id, name, employment_type, staff_category, position').eq('owner_id', owner).eq('status', 'active')
      .or(`store.eq.${pgQuote(store)},managed_stores.cs.{${pgQuote(store)}}`).order('name'),
    db.from('shift_avail_rules').select('id, employee_id, start_date, end_date, weekdays, start_min, end_min, note')
      .eq('owner_id', owner).eq('store', store).lte('start_date', to).gte('end_date', from),
    db.from('shift_plans').select('id, employee_id, work_date, start_min, end_min, status')
      .eq('owner_id', owner).eq('store', store).gte('work_date', from).lte('work_date', to),
    db.from('shift_needs').select('id, weekdays, start_min, end_min, headcount').eq('owner_id', owner).eq('store', store).order('start_min'),
  ])
  // 已不在本店但仍有可上班規則或班表的員工也列出，避免資料看不到
  const known = new Set((emps ?? []).map(e => e.id))
  const extraIds = [...new Set([...(rules ?? []), ...(plans ?? [])].map(r => r.employee_id).filter(id => !known.has(id)))]
  const { data: extra } = extraIds.length
    ? await db.from('hr_employees').select('id, name, employment_type, staff_category, position').eq('owner_id', owner).in('id', extraIds)
    : { data: [] }
  const all = [...(emps ?? []), ...(extra ?? [])]
  // 正職的期待休假日
  const { data: dayoffs } = all.length
    ? await db.from('shift_dayoff_requests').select('employee_id, off_date, note').eq('owner_id', owner)
      .in('employee_id', all.map(e => e.id)).gte('off_date', from).lte('off_date', to)
    : { data: [] }
  return NextResponse.json({ employees: all, rules: rules ?? [], plans: plans ?? [], needs: needs ?? [], dayoffs: dayoffs ?? [] })
}
