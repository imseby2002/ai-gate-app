import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const EMP_TYPES = new Set(['full-time', 'part-time', 'contract', 'intern'])
const EMP_STATUS = new Set(['active', 'inactive', 'resigned'])
const STAFF_CATS = new Set(['fulltime', 'hourly'])

// 批次匯入員工。body: { rows: Record<string, unknown>[] }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'no rows' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []
  const toInsert: Record<string, unknown>[] = []

  rows.forEach((r, i) => {
    const line = i + 2 // 對應 CSV 檔列號（含標題列）
    const name = String(r.name ?? '').trim()
    if (!name) { errors.push({ line, reason: '缺少姓名' }); return }
    const employment_type = EMP_TYPES.has(String(r.employment_type)) ? String(r.employment_type) : 'full-time'
    const status = EMP_STATUS.has(String(r.status)) ? String(r.status) : 'active'
    const staff_category = STAFF_CATS.has(String(r.staff_category)) ? String(r.staff_category) : 'fulltime'
    toInsert.push({
      owner_id: user.id,
      name,
      email: String(r.email ?? ''),
      phone: String(r.phone ?? ''),
      department: String(r.department ?? ''),
      position: String(r.position ?? ''),
      employment_type,
      hire_date: r.hire_date ? String(r.hire_date) : null,
      base_salary: Number(r.base_salary) || 0,
      bank_account: String(r.bank_account ?? ''),
      id_number: String(r.id_number ?? ''),
      notes: String(r.notes ?? ''),
      status,
      staff_category,
      hourly_rate: Number(r.hourly_rate) || 0,
      attendance_no: String(r.attendance_no ?? ''),
      store: String(r.store ?? ''),
      bank_name: String(r.bank_name ?? ''),
    })
  })

  let inserted = 0
  if (toInsert.length) {
    const { data, error } = await supabase.from('hr_employees').insert(toInsert).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ inserted, errors })
}
