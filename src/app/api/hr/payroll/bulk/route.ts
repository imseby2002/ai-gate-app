import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { matchEmployee, PAYROLL_NUM_FIELDS, PAYROLL_TEXT_FIELDS, type EmpLite } from '@/lib/hr/payroll-match'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
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
  payroll_code: string
  // 越南薪資表明細欄位（有才寫入，一般範本匯入不會動到）
  detail: Record<string, unknown>
}

// 批次匯入薪資。body: { rows }
// item 3：名單裡沒有的姓名會自動建立員工（姓名 + 底薪），達成兩邊同步。
export async function POST(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

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
        payroll_code: String(r.payroll_code ?? '').trim(),
        detail: Object.fromEntries([
          ...PAYROLL_NUM_FIELDS.filter(k => k in r).map(k => [k, Number(r[k]) || 0]),
          ...PAYROLL_TEXT_FIELDS.filter(k => k in r).map(k => [k, String(r[k] ?? '').trim()]),
          ...('source' in r ? [['source', String(r.source ?? '').slice(0, 200)]] : []),
        ]),
      },
    })
  })

  // 2) 比對員工：會計編號（Mã NV）＋相近姓名優先，其次同名（lib/hr/payroll-match.ts）
  const { data: emps } = await supabase
    .from('hr_employees').select('id, name, payroll_code, status').eq('owner_id', user.id)
  const empList = (emps ?? []) as EmpLite[]
  const resolved = new Map<number, string>() // line → employee_id
  const missing = new Map<string, { line: number; row: PayRow }[]>() // 待建立：name|code → 列
  for (const v of valid) {
    const m = matchEmployee(empList, v.row.name, v.row.payroll_code)
    if (m.id !== null) { resolved.set(v.line, m.id); continue }
    if (m.reason === 'ambiguous') { errors.push({ line: v.line, reason: `員工姓名「${v.row.name}」重複，請改用單筆新增` }); continue }
    const k = `${v.row.name}|${v.row.payroll_code}`
    missing.set(k, [...(missing.get(k) ?? []), v])
  }

  // 3) 名單裡沒有的人自動建立員工（item 3），帶入會計編號／門市／職稱
  let createdEmployees = 0
  if (missing.size) {
    const keys = Array.from(missing.keys())
    const newEmps = keys.map(k => {
      const { row } = missing.get(k)![0]
      return {
        owner_id: user.id, name: row.name, base_salary: row.base_salary, status: 'active', employment_type: 'full-time',
        payroll_code: row.payroll_code,
        ...(row.detail.store ? { store: String(row.detail.store) } : {}),
        ...(row.detail.position ? { position: String(row.detail.position) } : {}),
      }
    })
    const { data: created, error: createErr } = await supabase
      .from('hr_employees').insert(newEmps).select('id, name, payroll_code')
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    for (const e of (created ?? []) as { id: string; name: string; payroll_code: string | null }[]) {
      for (const v of missing.get(`${e.name}|${e.payroll_code ?? ''}`) ?? []) resolved.set(v.line, e.id)
    }
    createdEmployees = created?.length ?? 0
  }

  // 4) 組薪資 upsert 列
  const toUpsert: Record<string, unknown>[] = []
  const now = new Date().toISOString()
  for (const { line, row } of valid) {
    const id = resolved.get(line)
    if (!id) continue
    toUpsert.push({
      owner_id: user.id, employee_id: id, year: row.year, month: row.month,
      base_salary: row.base_salary, allowances: row.allowances,
      deductions: row.deductions, bonus: row.bonus, notes: row.notes, updated_at: now,
      ...row.detail,
    })
  }
  // 同一檔案同一員工同月重複時，upsert 會失敗：保留最後一筆
  const dedup = new Map<string, Record<string, unknown>>()
  for (const r of toUpsert) dedup.set(`${r.employee_id}|${r.year}|${r.month}`, r)
  toUpsert.length = 0
  toUpsert.push(...dedup.values())

  let inserted = 0
  if (toUpsert.length) {
    const { data, error } = await supabase
      .from('hr_payroll').upsert(toUpsert, { onConflict: 'employee_id,year,month' }).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ inserted, errors, createdEmployees })
}
