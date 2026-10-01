import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { computePit, dependentActive, normalizeSettings, resolveMethod, PIT_METHODS as METHODS, type PitMethod } from '@/lib/acc/pit'

// 個人稅月扣繳：GET 查月（或整年彙總）、POST 由薪資單產生、PATCH 手動調整單筆
const deny = (status: number) => NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
const n = (v: unknown) => Number(v) || 0

export async function GET(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '')
  const month = parseInt(sp.get('month') ?? '')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  let q = ctx.admin.from('acc_pit_monthly')
    .select('*, hr_employees(name, attendance_no, store, tax_code, id_number)')
    .eq('owner_id', ctx.ownerId).eq('year', year)
  if (month) q = q.eq('month', month)
  const { data, error } = await q.order('month')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// 由該月 hr_payroll 產生／重算（保留已手動填的免稅所得、備註）
// 由會計薪資表匯入的列（source = import:*）直接採用表上實際扣繳數字，不重算
export async function POST(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const { admin, ownerId } = ctx
  const body = await req.json().catch(() => ({}))
  const year = parseInt(body.year), month = parseInt(body.month)
  if (!year || !month || month < 1 || month > 12) return NextResponse.json({ error: 'year, month required' }, { status: 400 })

  const [pay, emps, deps, set, existing] = await Promise.all([
    admin.from('hr_payroll').select('employee_id, base_salary, allowances, bonus, source, gross_total, non_taxable_income, employee_insurance, personal_deduction, dependent_deduction, assessable_contract, assessable_casual, pit_contract, pit_casual').eq('owner_id', ownerId).eq('year', year).eq('month', month),
    admin.from('hr_employees').select('id, staff_category, pit_method, insurance_status, insurance_salary').eq('owner_id', ownerId),
    admin.from('hr_tax_dependents').select('employee_id, from_month, to_month').eq('owner_id', ownerId),
    admin.from('acc_pit_settings').select('*').eq('owner_id', ownerId).maybeSingle(),
    admin.from('acc_pit_monthly').select('employee_id, exempt_income, note, method').eq('owner_id', ownerId).eq('year', year).eq('month', month),
  ])
  const err = pay.error ?? emps.error ?? deps.error ?? set.error ?? existing.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  const s = normalizeSettings(set.data)
  const empMap = new Map((emps.data ?? []).map(e => [e.id, e]))
  const prev = new Map((existing.data ?? []).map(r => [r.employee_id, r]))
  const depCount = new Map<string, number>()
  for (const d of deps.data ?? []) if (dependentActive(d, year, month)) depCount.set(d.employee_id, (depCount.get(d.employee_id) ?? 0) + 1)

  const rows = (pay.data ?? []).flatMap(p => {
    const e = empMap.get(p.employee_id)
    if (!e) return []
    const old = prev.get(p.employee_id)
    if (p.source?.startsWith('import:')) {
      const casual = n(p.pit_casual) > 0 || n(p.assessable_casual) > 0
      const contract = n(p.pit_contract) > 0 || n(p.personal_deduction) > 0
      const r = {
        method: (casual ? 'flat10' : contract ? 'progressive' : 'none') as PitMethod,
        gross_income: n(p.gross_total),
        exempt_income: n(p.non_taxable_income),
        insurance_deduction: n(p.employee_insurance),
        dependents: s.dependent_deduction > 0 ? Math.round(n(p.dependent_deduction) / s.dependent_deduction) : 0,
        personal_deduction: n(p.personal_deduction),
        dependent_deduction: n(p.dependent_deduction),
        taxable_income: n(p.assessable_contract) + n(p.assessable_casual),
        tax_amount: Math.round(n(p.pit_contract) + n(p.pit_casual)),
      }
      return [{ owner_id: ownerId, employee_id: p.employee_id, year, month, ...r, note: old?.note ?? '', updated_at: new Date().toISOString() }]
    }
    const r = computePit({
      method: (old?.method as PitMethod) ?? resolveMethod(e),
      gross_income: n(p.base_salary) + n(p.allowances) + n(p.bonus),
      exempt_income: n(old?.exempt_income),
      insurance_deduction: e.insurance_status === 'enrolled' ? Math.round(n(e.insurance_salary) * s.insurance_rate) : 0,
      dependents: depCount.get(p.employee_id) ?? 0,
    }, s)
    return [{ owner_id: ownerId, employee_id: p.employee_id, year, month, ...r, note: old?.note ?? '', updated_at: new Date().toISOString() }]
  })
  if (rows.length === 0) return NextResponse.json({ rows: [], generated: 0, message: '該月尚無薪資資料' })

  const { error } = await admin.from('acc_pit_monthly').upsert(rows, { onConflict: 'employee_id,year,month' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ generated: rows.length })
}

// 手動調整單筆後重算
export async function PATCH(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const { admin, ownerId } = ctx
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const [{ data: row, error: rErr }, { data: set, error: sErr }] = await Promise.all([
    admin.from('acc_pit_monthly').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle(),
    admin.from('acc_pit_settings').select('*').eq('owner_id', ownerId).maybeSingle(),
  ])
  if (rErr || sErr) return NextResponse.json({ error: (rErr ?? sErr)!.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const method = METHODS.includes(body.method) ? body.method as PitMethod : row.method as PitMethod
  const r = computePit({
    method,
    gross_income: 'gross_income' in body ? n(body.gross_income) : n(row.gross_income),
    exempt_income: 'exempt_income' in body ? n(body.exempt_income) : n(row.exempt_income),
    insurance_deduction: 'insurance_deduction' in body ? n(body.insurance_deduction) : n(row.insurance_deduction),
    dependents: 'dependents' in body ? Math.max(0, Math.floor(n(body.dependents))) : row.dependents,
  }, normalizeSettings(set))

  const { data, error } = await admin.from('acc_pit_monthly')
    .update({ ...r, note: typeof body.note === 'string' ? body.note : row.note, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', ownerId).select('*, hr_employees(name, attendance_no, store, tax_code, id_number)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}
