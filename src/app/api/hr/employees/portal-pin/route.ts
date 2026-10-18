import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { hashPin, portalUrlForEmployee } from '@/lib/hr/portal'

// 人事發臨時密碼給員工專區（例如沒有生日的員工）：產生 8 位數字密碼，
// 舊密碼失效、解除鎖定；員工用它登入後必須改成自己的密碼。body: { employee_id }
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { employee_id } = await req.json().catch(() => ({}))
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })

  const { data: emp } = await ctx.admin.from('hr_employees')
    .select('id, name, attendance_no, status').eq('id', String(employee_id)).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: '查無此員工' }, { status: 404 })
  if (!String(emp.attendance_no ?? '').trim()) return NextResponse.json({ error: '請先設定打卡編號，員工專區以打卡編號登入' }, { status: 400 })
  if (emp.status !== 'active') return NextResponse.json({ error: '僅在職員工可登入員工專區' }, { status: 400 })

  const pin = String(randomInt(0, 100_000_000)).padStart(8, '0')
  const { error } = await ctx.admin.from('hr_employee_portal').upsert({
    employee_id: emp.id, pin_hash: hashPin(pin), pin_temp: true, failed_count: 0, locked_until: null, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const url = await portalUrlForEmployee(ctx.ownerId, String(emp.attendance_no).trim())
  return NextResponse.json({ pin, url, name: emp.name, attendance_no: emp.attendance_no })
}
