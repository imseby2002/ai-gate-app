import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

interface PayRow {
  name: string
  year: number
  month: number
  base_salary: number
  allowances: number
  deductions: number
  bonus: number
  notes: string
}

// 批次匯入薪資。body: { rows }
// item 3：名單裡沒有的姓名會自動建立員工（姓名 + 底薪），達成兩邊同步。
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'no rows' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  // 1) 驗證每列
  const valid: { line: number; row: PayRow }[] = []
  rows.forEach((r, i) => {
    const line = i + 2
    const name = String(r.name ?? '').trim()
    const year = Number(r.year)
    const month = Number(r.month)
    if (!name) { errors.push({ line, reason: '缺少員工姓名' }); return }
    if (!year || year < 2000 || year > 2100) { errors.push({ line, reason: '年份無效' }); return }
    if (!month || month < 1 || month > 12) { errors.push({ line, reason: '月份無效' }); return }
    valid.push({
      line,
      row: {
        name, year, month,
        base_salary: Number(r.base_salary) || 0,
        allowances: Number(r.allowances) || 0,
        deductions: Number(r.deductions) || 0,
        bonus: Number(r.bonus) || 0,
        notes: String(r.notes ?? ''),
      },
    })
  })

  // 2) 建立姓名 → id 對照（含重名偵測）
  const { data: emps } = await supabase
    .from('hr_employees').select('id, name').eq('owner_id', user.id)
  const byName = new Map<string, string[]>()
  for (const e of (emps ?? []) as { id: string; name: string }[]) {
    const k = e.name.trim()
    byName.set(k, [...(byName.get(k) ?? []), e.id])
  }

  // 3) 針對名單裡沒有的姓名，自動建立員工（item 3）
  const missingNames = new Map<string, number>() // name → 首次出現的底薪
  for (const { row } of valid) {
    const ids = byName.get(row.name)
    if (!ids && !missingNames.has(row.name)) missingNames.set(row.name, row.base_salary)
  }
  let createdEmployees = 0
  if (missingNames.size) {
    const newEmps = Array.from(missingNames.entries()).map(([name, base]) => ({
      owner_id: user.id, name, base_salary: base, status: 'active', employment_type: 'full-time',
    }))
    const { data: created, error: createErr } = await supabase
      .from('hr_employees').insert(newEmps).select('id, name')
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    for (const e of (created ?? []) as { id: string; name: string }[]) {
      byName.set(e.name.trim(), [e.id])
    }
    createdEmployees = created?.length ?? 0
  }

  // 4) 組薪資 upsert 列（重名無法判斷 → 標錯）
  const toUpsert: Record<string, unknown>[] = []
  const now = new Date().toISOString()
  for (const { line, row } of valid) {
    const ids = byName.get(row.name)
    if (!ids || ids.length === 0) { errors.push({ line, reason: `找不到員工「${row.name}」` }); continue }
    if (ids.length > 1) { errors.push({ line, reason: `員工姓名「${row.name}」重複，請改用單筆新增` }); continue }
    toUpsert.push({
      owner_id: user.id, employee_id: ids[0], year: row.year, month: row.month,
      base_salary: row.base_salary, allowances: row.allowances,
      deductions: row.deductions, bonus: row.bonus, notes: row.notes, updated_at: now,
    })
  }

  let inserted = 0
  if (toUpsert.length) {
    const { data, error } = await supabase
      .from('hr_payroll').upsert(toUpsert, { onConflict: 'employee_id,year,month' }).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ inserted, errors, createdEmployees })
}
