/**
 * 越南會計薪資表（bảng lương, 例：「092026 bang luong- noi bo chot.xls」的 LT9 工作表）解析。
 * - 自動找出含「Mã NV／Tên／Lương cb」的標題列（不必在第一列）
 * - 月份：檔名 MMYYYY（092026）或表頭「BẢNG LƯƠNG THÁNG 09」；年份：檔名
 * - 彙總欄位規則同 supabase/migrations/20261001_hr_payroll_detail.sql：
 *     base_salary = Lương cb
 *     allowances  = Lương trách nhiệm + Tiền làm thêm + trợ cấp
 *     bonus       = Thưởng tháng + khống chế giá thành／trách nhiệm + KPI + doanh thu + lễ tết + hoa hồng
 *     deductions  = 罰款 + 員工保險 + 工會費 + 制服 + TTNCN（合約＋短期）
 *   並與表上「Thanh toán lương」核對。
 */
import * as XLSX from 'xlsx'
import type { ParseResult } from '@/lib/excel/universal-import'

/** 去聲調、đ→d、小寫、壓縮空白 */
export function normVi(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

export { PAYROLL_NUM_FIELDS, PAYROLL_TEXT_FIELDS } from '@/lib/hr/payroll-match'
import { PAYROLL_NUM_FIELDS } from '@/lib/hr/payroll-match'

// 標題（正規化後）→ 欄位；同一欄位只取第一個符合的標題
const HEADER_RULES: [RegExp, string][] = [
  [/^ma nv$/, 'payroll_code'],
  [/^(ten|ho (va )?ten)$/, 'name'],
  [/^chuc vu$/, 'position'],
  [/^cua hang$/, 'store'],
  [/^xep hang$/, 'rank'],
  [/^so gio lam them$/, 'ot_hours'],
  [/^luong bao hiem$/, 'insurance_salary'],
  [/^luong (cb|co ban)$/, 'base_salary'],
  [/^luong trach nhiem$/, 'responsibility_pay'],
  [/^tien lam them$/, 'overtime_pay'],
  [/^thuong thang$/, 'monthly_bonus'],
  [/^thuong (khong che|trach nhiem)/, 'responsibility_bonus'],
  [/^kpi/, 'kpi_bonus'],
  [/^thuong (dthu|doanh thu)/, 'revenue_bonus'],
  [/^thuong le/, 'holiday_bonus'],
  [/^thuong hoa hong/, 'commission'],
  [/^tro cap/, 'meal_travel_allowance'],
  [/^tong luong$/, 'gross_total'],
  [/^tn khong chiu thue$/, 'non_taxable_income'],
  [/^tn chiu thue$/, 'taxable_income'],
  [/^(thieu dthu|phat)/, 'penalty'],
  [/^bhxh nhan vien$/, 'employee_insurance'],
  [/^doan phi/, 'union_fee'],
  [/^dong phuc$/, 'uniform_fee'],
  [/^gtbt$/, 'personal_deduction'],
  [/^gtnpt$/, 'dependent_deduction'],
  [/^lao dong hd$/, 'assessable_contract'],
  [/^lao dong thoi vu$/, 'assessable_casual'],
  [/^ttncn lao dong hd$/, 'pit_contract'],
  [/^ttncn lao dong thoi vu$/, 'pit_casual'],
  [/^thanh toan luong$/, 'net_check'],
  [/^bhxh doanh nghiep$/, 'employer_insurance'],
  [/^cong doan$/, 'employer_union'],
]

const num = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(String(v ?? '').replace(/[,\s₫]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function mapHeader(row: unknown[]): Map<string, number> {
  const m = new Map<string, number>()
  row.forEach((h, i) => {
    const t = normVi(h)
    if (!t) return
    for (const [re, key] of HEADER_RULES) {
      if (re.test(t)) { if (!m.has(key)) m.set(key, i); break }
    }
  })
  return m
}

/** 是否為越南薪資表：任一工作表前 15 列有 Mã NV + Tên + Lương cb */
function findHeader(rows: unknown[][]): { idx: number; map: Map<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const map = mapHeader(rows[i] ?? [])
    if (map.has('payroll_code') && map.has('name') && map.has('base_salary')) return { idx: i, map }
  }
  return null
}

function titleMonth(rows: unknown[][]): number | null {
  for (const r of rows.slice(0, 6)) for (const c of r ?? []) {
    const m = normVi(c).match(/bang luong thang (\d{1,2})/)
    if (m) return Number(m[1])
  }
  return null
}

/** 解析越南薪資表；不是這種格式時回傳 null（改用一般匯入） */
export async function parseVnPayrollFile(file: File): Promise<ParseResult | null> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheets = wb.SheetNames.map(name => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    return { name, rows, header: findHeader(rows), month: titleMonth(rows) }
  }).filter(s => s.header)
  if (!sheets.length) return null

  const fm = file.name.match(/(?:^|\D)(\d{2})(20\d{2})(?:\D|$)/)
  const fileMonth = fm ? Number(fm[1]) : null
  const year = fm ? Number(fm[2]) : null
  const sheet = (fileMonth && sheets.find(s => s.month === fileMonth))
    || (sheets.length === 1 ? sheets[0] : sheets.filter(s => s.month).sort((a, b) => (b.month ?? 0) - (a.month ?? 0))[0])
    || sheets[0]
  const month = fileMonth ?? sheet.month
  const errors: { line: number; message: string }[] = []
  if (!year || !month || month < 1 || month > 12) {
    errors.push({ line: 1, message: '無法判斷年月：檔名需含 MMYYYY（例：092026 = 2026 年 9 月）' })
  }

  const { idx, map } = sheet.header!
  const col = (r: unknown[], k: string) => (map.has(k) ? r[map.get(k)!] : '')
  const out: Record<string, unknown>[] = []
  for (let i = idx + 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i] ?? []
    const code = String(col(r, 'payroll_code') ?? '').trim()
    const name = String(col(r, 'name') ?? '').replace(/[·•]/g, '').trim()
    if (!code || !name) continue // 合計、分區標題、空白列
    const v: Record<string, number> = {}
    for (const k of PAYROLL_NUM_FIELDS) v[k] = num(col(r, k))
    const base = num(col(r, 'base_salary'))
    const netCheck = num(col(r, 'net_check'))
    if (v.gross_total === 0 && netCheck === 0 && base === 0) continue // 當月無薪資
    const allowances = v.responsibility_pay + v.overtime_pay + v.meal_travel_allowance
    const bonus = v.monthly_bonus + v.responsibility_bonus + v.kpi_bonus + v.revenue_bonus + v.holiday_bonus + v.commission
    const deductions = v.penalty + v.employee_insurance + v.union_fee + v.uniform_fee + v.pit_contract + v.pit_casual
    if (map.has('net_check') && Math.abs(base + allowances + bonus - deductions - netCheck) > 1) {
      errors.push({ line: i + 1, message: `第 ${i + 1} 列 ${code} ${name}：明細加總與「Thanh toán lương」不符` })
    }
    out.push({
      name, year, month,
      base_salary: base, allowances, bonus, deductions,
      notes: '',
      payroll_code: code,
      store: String(col(r, 'store') ?? '').trim(),
      position: String(col(r, 'position') ?? '').trim(),
      rank: String(col(r, 'rank') ?? '').trim(),
      ...v,
      source: `import:${file.name}`,
    })
  }
  if (!out.length) errors.push({ line: idx + 1, message: `工作表「${sheet.name}」沒有可匯入的薪資列` })
  return { rows: out, totalRawRows: sheet.rows.length - idx - 1, headers: (sheet.rows[idx] ?? []).map(String), errors }
}
