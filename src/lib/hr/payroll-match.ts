/**
 * 薪資匯入的員工比對：
 * 1. 會計編號（Mã NV）相同且姓名相近 → 同一人（容許拼法差異，如 Phan／Phạm Đức Tâm、少了中間名）
 * 2. 否則姓名完全相同（不分大小寫、聲調）且只有一位 → 同一人
 * 3. 都沒有 → 由呼叫端建立新員工
 * 編號相同但姓名差很多時視為編號已改給別人，不採用。
 */
export const PAYROLL_NUM_FIELDS = [
  'ot_hours', 'insurance_salary', 'responsibility_pay', 'overtime_pay', 'monthly_bonus', 'responsibility_bonus',
  'kpi_bonus', 'revenue_bonus', 'holiday_bonus', 'commission', 'meal_travel_allowance', 'gross_total',
  'non_taxable_income', 'taxable_income', 'penalty', 'employee_insurance', 'union_fee', 'uniform_fee',
  'personal_deduction', 'dependent_deduction', 'assessable_contract', 'assessable_casual', 'pit_contract',
  'pit_casual', 'employer_insurance', 'employer_union',
] as const
export const PAYROLL_TEXT_FIELDS = ['payroll_code', 'store', 'position', 'rank'] as const

export interface EmpLite { id: string; name: string; payroll_code?: string | null; status?: string | null }

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
const tokens = (s: string) => fold(s).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)

export function namesSimilar(a: string, b: string): boolean {
  const ta = tokens(a), tb = tokens(b)
  if (ta.join('') === tb.join('')) return true
  const sb = new Set(tb)
  const common = ta.filter(t => sb.has(t)).length
  return common >= 2 && common >= Math.ceil(Math.min(ta.length, tb.length) * 2 / 3)
}

const preferActive = (list: EmpLite[]) => list.find(e => e.status !== 'resigned') ?? list[0]

export function matchEmployee(emps: EmpLite[], name: string, code?: string): { id: string; by: 'code' | 'name' } | { id: null; reason: 'none' | 'ambiguous' } {
  const c = (code ?? '').trim()
  if (c) {
    const byCode = emps.filter(e => (e.payroll_code ?? '').trim() === c && namesSimilar(e.name, name))
    if (byCode.length) return { id: preferActive(byCode).id, by: 'code' }
  }
  const key = tokens(name).join(' ')
  const byName = emps.filter(e => tokens(e.name).join(' ') === key)
  if (byName.length === 1) return { id: byName[0].id, by: 'name' }
  if (byName.length > 1) {
    const active = byName.filter(e => e.status !== 'resigned')
    if (active.length === 1) return { id: active[0].id, by: 'name' }
    return { id: null, reason: 'ambiguous' }
  }
  return { id: null, reason: 'none' }
}
