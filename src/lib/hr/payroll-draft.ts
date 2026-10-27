/**
 * 自動產生某月薪資草稿（人只需檢查、修正）：
 * - 以「上一個有薪資資料的月份」為底稿（每人一列）
 * - 個人資料（會計編號、門市、職稱）取人事資料；正職底薪人事有填就用人事，否則沿用上月
 * - 兼職底薪沿用上月（工時制，需人工確認）
 * - 固定與浮動獎金沿用上月；加班、節慶獎金、罰款、制服費這類一次性項目歸零
 * - 領班評分＋辦公室評分：評等獎金＋評分獎金＋獎勵 → KPI 獎金；懲罰 → 罰款；評等 → Xếp hạng
 * - 保險：投保薪資有變就依比例調整
 * - 所得稅：短期勞工 10%（與現行薪資表一致）；勞動合約所得稅公式表上無法還原，沿用上月並標記需確認
 * 已有該月薪資的人不動（除非是尚未被修改的自動草稿且選擇覆蓋）。
 */
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>
type Row = Record<string, unknown>

const n = (v: unknown) => Number(v) || 0
const round2 = (x: number) => Math.round(x * 100) / 100

// 沿用上月的數值欄位
const CARRY = ['responsibility_pay', 'meal_travel_allowance', 'monthly_bonus', 'responsibility_bonus', 'kpi_bonus',
  'revenue_bonus', 'commission', 'personal_deduction', 'dependent_deduction', 'employee_insurance', 'union_fee',
  'employer_insurance', 'employer_union', 'insurance_salary', 'pit_contract'] as const
// 一次性項目歸零
const RESET = ['ot_hours', 'overtime_pay', 'holiday_bonus', 'penalty', 'uniform_fee'] as const

export interface DraftResult {
  baseMonth: { year: number; month: number } | null
  created: number
  overwritten: number
  skippedExisting: number
  skippedNoData: number
  flagged: number
}

function prevYm(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/** 單一員工的草稿列（純計算，不含 owner／年月／狀態）；回傳 null 表示不建立 */
export function buildDraftRow(e: Row, prev: Row | undefined, ev: Row[]): { row: Row; flags: string[] } | null {
  const hrBase = n(e.base_salary)
  if (!prev && hrBase <= 0 && ev.length === 0) return null
  const flags: string[] = []
  const partTime = e.employment_type === 'part-time' || e.staff_category === 'hourly'
  const r: Row = {}
  for (const k of CARRY) r[k] = prev ? n(prev[k]) : 0
  for (const k of RESET) r[k] = 0

  // 底薪
  let baseSalary: number
  if (partTime) { baseSalary = prev ? n(prev.base_salary) : hrBase; flags.push('兼職底薪沿用上月，請依本月工時修改') }
  else baseSalary = hrBase > 0 ? hrBase : (prev ? n(prev.base_salary) : 0)
  if (!prev) flags.push('無上月薪資，獎金與扣款請確認')

  // 保險：人事有填投保薪資且需投保 → 依比例調整
  const newIns = e.insurance_required && n(e.insurance_salary) > 0 ? n(e.insurance_salary) : n(r.insurance_salary)
  if (n(r.insurance_salary) > 0 && newIns !== n(r.insurance_salary)) {
    const ratio = newIns / n(r.insurance_salary)
    for (const k of ['employee_insurance', 'union_fee', 'employer_insurance', 'employer_union'] as const) r[k] = round2(n(r[k]) * ratio)
    flags.push('投保薪資變動，保險費已依比例調整')
  }
  r.insurance_salary = newIns

  // 評分
  let rank = prev ? String(prev.rank ?? '') : ''
  if (ev.length) {
    const storeEv = ev.find(x => x.kind === 'store'), officeEv = ev.find(x => x.kind === 'office')
    rank = String(storeEv?.rating || officeEv?.rating || rank)
    r.kpi_bonus = ev.reduce((s, x) => s + n(x.tier_amount) + n(x.bonus) + n(x.reward_total), 0)
    r.penalty = ev.reduce((s, x) => s + n(x.penalty_total), 0)
  }

  // 彙總與所得稅
  const allowances = n(r.responsibility_pay) + n(r.overtime_pay) + n(r.meal_travel_allowance)
  const bonus = n(r.monthly_bonus) + n(r.responsibility_bonus) + n(r.kpi_bonus) + n(r.revenue_bonus) + n(r.holiday_bonus) + n(r.commission)
  const gross = baseSalary + allowances + bonus
  const nonTax = n(r.meal_travel_allowance)
  const taxable = Math.max(0, gross - nonTax)
  const casual = prev ? (n(prev.assessable_casual) > 0 || n(prev.pit_casual) > 0) : partTime
  let assessContract = 0, assessCasual = 0, pitCasual = 0
  if (casual) {
    assessCasual = Math.max(0, taxable - n(r.penalty))
    pitCasual = round2(assessCasual * 0.1)
    r.pit_contract = 0
  } else {
    assessContract = Math.max(0, taxable - n(r.employee_insurance) - n(r.union_fee) - n(r.personal_deduction) - n(r.dependent_deduction))
    if (assessContract <= 0) r.pit_contract = 0
    else flags.push('合約所得稅沿用上月，請確認')
  }
  const deductions = n(r.penalty) + n(r.employee_insurance) + n(r.union_fee) + n(r.uniform_fee) + n(r.pit_contract) + pitCasual

  return {
    flags,
    row: {
      payroll_code: String(e.payroll_code || prev?.payroll_code || ''),
      store: String(prev?.store || e.store || ''),
      position: String(prev?.position || e.position || ''),
      rank,
      ...r,
      base_salary: baseSalary, allowances: round2(allowances), bonus: round2(bonus), deductions: round2(deductions),
      gross_total: round2(gross), non_taxable_income: nonTax, taxable_income: round2(taxable),
      assessable_contract: round2(assessContract), assessable_casual: round2(assessCasual),
      pit_casual: pitCasual,
    },
  }
}

export async function generatePayrollDraft(admin: Admin, ownerId: string, year: number, month: number, overwriteAuto: boolean): Promise<DraftResult> {
  // 1) 找底稿月份：往前最多 12 個月，第一個有資料的月份
  let base: { year: number; month: number } | null = null
  let cur = prevYm(year, month)
  for (let i = 0; i < 12 && !base; i++, cur = prevYm(cur.year, cur.month)) {
    const { count } = await admin.from('hr_payroll').select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId).eq('year', cur.year).eq('month', cur.month)
    if (count) base = cur
  }

  const [{ data: emps, error: empErr }, prevRes, { data: existing }, { data: evals }] = await Promise.all([
    admin.from('hr_employees').select('id, name, status, employment_type, staff_category, base_salary, insurance_required, insurance_salary, payroll_code, store, position')
      .eq('owner_id', ownerId).neq('status', 'resigned'),
    base
      ? admin.from('hr_payroll').select('*').eq('owner_id', ownerId).eq('year', base.year).eq('month', base.month)
      : Promise.resolve({ data: [] as Row[] }),
    admin.from('hr_payroll').select('id, employee_id, source').eq('owner_id', ownerId).eq('year', year).eq('month', month),
    admin.from('hr_evaluations').select('employee_id, kind, rating, bonus, tier_amount, reward_total, penalty_total')
      .eq('owner_id', ownerId).eq('year', year).eq('month', month),
  ])
  if (empErr) throw new Error(empErr.message)

  const prevBy = new Map<string, Row>(((prevRes.data ?? []) as Row[]).map(r => [String(r.employee_id), r]))
  const existBy = new Map<string, { id: string; source: string }>(((existing ?? []) as { id: string; employee_id: string; source: string }[]).map(r => [r.employee_id, r]))
  const evalBy = new Map<string, Row[]>()
  for (const e of (evals ?? []) as Row[]) evalBy.set(String(e.employee_id), [...(evalBy.get(String(e.employee_id)) ?? []), e])

  const res: DraftResult = { baseMonth: base, created: 0, overwritten: 0, skippedExisting: 0, skippedNoData: 0, flagged: 0 }
  const rows: Row[] = []
  const now = new Date().toISOString()
  const source = `auto:${year}-${String(month).padStart(2, '0')}` + (base ? ` from ${base.year}-${String(base.month).padStart(2, '0')}` : '')

  for (const e of (emps ?? []) as Row[]) {
    const id = String(e.id)
    const ex = existBy.get(id)
    if (ex && !(overwriteAuto && String(ex.source ?? '').startsWith('auto:'))) { res.skippedExisting++; continue }
    const built = buildDraftRow(e, prevBy.get(id), evalBy.get(id) ?? [])
    if (!built) { res.skippedNoData++; continue } // 無上月薪資、無底薪、無評分：不建立
    if (built.flags.length) res.flagged++
    rows.push({
      owner_id: ownerId, employee_id: id, year, month,
      ...built.row,
      notes: built.flags.length ? `[自動草稿] ${built.flags.join('；')}` : '[自動草稿]',
      status: 'pending', source, updated_at: now,
    })
    if (ex) res.overwritten++; else res.created++
  }

  if (rows.length) {
    const { error } = await admin.from('hr_payroll').upsert(rows, { onConflict: 'employee_id,year,month' })
    if (error) throw new Error(error.message)
  }
  return res
}
