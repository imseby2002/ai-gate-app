// 越南個人所得稅（Thuế TNCN）— 薪資所得月扣繳計算
// 預設參數（2026 起）：
//  - 五級累進稅率：Luật Thuế TNCN số 109/2025/QH15，自 2026 課稅期適用於薪資所得
//  - 家庭扣除：本人 15.5M、每位扶養人 6.2M／月（Nghị quyết 110/2025/UBTVQH15，2026 課稅期起）
//  - 員工自付強制保險 10.5%（BHXH 8%＋BHYT 1.5%＋BHTN 1%）可自所得扣除
//  - 無勞動合約或合約未滿 3 個月：每次給付達門檻即就源扣繳 10%（NĐ 253/2026/NĐ-CP：門檻 5M，2026-07-01 起）
// 參數皆存於 acc_pit_settings，可依公司／法規調整。

export interface PitBracket { upTo: number | null; rate: number }

export interface PitSettings {
  personal_deduction: number
  dependent_deduction: number
  brackets: PitBracket[]
  insurance_rate: number
  casual_rate: number
  casual_threshold: number
}

export const DEFAULT_PIT_SETTINGS: PitSettings = {
  personal_deduction: 15_500_000,
  dependent_deduction: 6_200_000,
  brackets: [
    { upTo: 10_000_000, rate: 0.05 },
    { upTo: 30_000_000, rate: 0.10 },
    { upTo: 60_000_000, rate: 0.20 },
    { upTo: 100_000_000, rate: 0.30 },
    { upTo: null, rate: 0.35 },
  ],
  insurance_rate: 0.105,
  casual_rate: 0.10,
  casual_threshold: 5_000_000,
}

export const PIT_SOURCES = [
  { label: 'Luật Thuế TNCN 109/2025/QH15（五級累進稅率）', url: 'https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/100277/bieu-thue-tncn-luy-tien-2026-bieu-thue-5-bac' },
  { label: 'Nghị quyết 110/2025/UBTVQH15（家庭扣除 15.5M / 6.2M）', url: 'https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-quyet-110-2025-UBTVQH15-muc-giam-tru-gia-canh-thue-thu-nhap-ca-nhan-665865.aspx' },
  { label: 'Nghị định 253/2026/NĐ-CP（短期/無合約 10% 扣繳門檻 5M）', url: 'https://thuvienphapluat.vn/phap-luat/ho-tro-phap-luat/chinh-thuc-khau-tru-thue-tncn-10-voi-thu-nhap-vang-lai-tu-5-trieu-donglan-tro-len-theo-nghi-dinh-25-278051.html' },
]

// 累進稅額（逐級計算）
export function progressiveTax(taxable: number, brackets: PitBracket[]): number {
  if (taxable <= 0) return 0
  let tax = 0
  let lower = 0
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity
    if (taxable <= lower) break
    tax += (Math.min(taxable, upper) - lower) * b.rate
    lower = upper
  }
  return Math.round(tax)
}

export type PitMethod = 'progressive' | 'flat10' | 'none'
export const PIT_METHODS: PitMethod[] = ['progressive', 'flat10', 'none']

// 員工未指定計稅方式時：正職→累進；兼職（通常無合約或未滿 3 個月）→10% 就源
export function resolveMethod(emp: { pit_method?: string | null; staff_category?: string | null }): PitMethod {
  if (emp.pit_method && PIT_METHODS.includes(emp.pit_method as PitMethod)) return emp.pit_method as PitMethod
  return emp.staff_category === 'hourly' ? 'flat10' : 'progressive'
}

export interface PitInput {
  method: PitMethod
  gross_income: number        // 應稅總所得（薪＋津貼＋獎金）
  exempt_income: number       // 免稅所得
  insurance_deduction: number // 員工自付保險
  dependents: number
}

export interface PitResult extends PitInput {
  personal_deduction: number
  dependent_deduction: number
  taxable_income: number
  tax_amount: number
}

export function computePit(input: PitInput, s: PitSettings): PitResult {
  const gross = Math.max(0, input.gross_income)
  const exempt = Math.max(0, input.exempt_income)
  if (input.method === 'none') {
    return { ...input, personal_deduction: 0, dependent_deduction: 0, taxable_income: 0, tax_amount: 0 }
  }
  if (input.method === 'flat10') {
    // 短期/無合約：就源扣繳，不適用家庭扣除；未達門檻不扣
    const base = gross - exempt
    const tax = base >= s.casual_threshold ? Math.round(base * s.casual_rate) : 0
    return { ...input, personal_deduction: 0, dependent_deduction: 0, taxable_income: Math.max(0, base), tax_amount: tax }
  }
  const personal = s.personal_deduction
  const dep = s.dependent_deduction * Math.max(0, input.dependents)
  const taxable = Math.max(0, gross - exempt - Math.max(0, input.insurance_deduction) - personal - dep)
  return { ...input, personal_deduction: personal, dependent_deduction: dep, taxable_income: taxable, tax_amount: progressiveTax(taxable, s.brackets) }
}

// 扶養人於某月是否有效（from/to 為 YYYY-MM，空＝不限）
export function dependentActive(d: { from_month: string; to_month: string }, year: number, month: number): boolean {
  const ym = `${year}-${String(month).padStart(2, '0')}`
  if (d.from_month && ym < d.from_month) return false
  if (d.to_month && ym > d.to_month) return false
  return true
}

export function normalizeSettings(row: Partial<PitSettings> | null | undefined): PitSettings {
  if (!row) return DEFAULT_PIT_SETTINGS
  return {
    personal_deduction: Number(row.personal_deduction ?? DEFAULT_PIT_SETTINGS.personal_deduction),
    dependent_deduction: Number(row.dependent_deduction ?? DEFAULT_PIT_SETTINGS.dependent_deduction),
    brackets: Array.isArray(row.brackets) && row.brackets.length ? row.brackets : DEFAULT_PIT_SETTINGS.brackets,
    insurance_rate: Number(row.insurance_rate ?? DEFAULT_PIT_SETTINGS.insurance_rate),
    casual_rate: Number(row.casual_rate ?? DEFAULT_PIT_SETTINGS.casual_rate),
    casual_threshold: Number(row.casual_threshold ?? DEFAULT_PIT_SETTINGS.casual_threshold),
  }
}
