import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { candidateForEmployee, setProfileEdit } from '@/lib/hr/profile'

// 人事開放／關閉員工在員工專區修改履歷。body: { employee_id, open: boolean }
export async function PUT(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { employee_id, open } = await req.json().catch(() => ({}))
  const { data: emp } = await ctx.admin.from('hr_employees').select('id, name, store, staff_category, phone, email')
    .eq('id', String(employee_id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const cid = await candidateForEmployee(ctx.admin, ctx.ownerId, emp, true)
  if (!cid) return NextResponse.json({ error: 'create failed' }, { status: 500 })
  const { data, error } = await setProfileEdit(ctx.admin, ctx.ownerId, cid, !!open)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidate: data })
}
