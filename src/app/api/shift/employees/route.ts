import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'

// 某門市在職員工（門市排班頁的員工評分用）。?store= 必填
export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const store = (req.nextUrl.searchParams.get('store') ?? '').trim()
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await ctx.admin.from('hr_employees')
    .select('id, name, store, status, employment_type')
    .eq('owner_id', ctx.ownerId).eq('store', store).eq('status', 'active').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data ?? [] })
}
