// 應徵單位與職位（前後端共用，不可引入 node 模組）
export type UnitKind = 'store' | 'office' | 'factory'
export const OFFICE_VALUE = '辦公室'

type L = { zh: string; en: string; vi: string }
// value 存中文（人事後台使用），顯示依語系
export const POSITIONS: Record<UnitKind, { value: string; label: L; category?: 'fulltime' | 'hourly' }[]> = {
  store: [
    { value: '正職', label: { zh: '正職', en: 'Full-time', vi: 'Nhân viên chính thức' }, category: 'fulltime' },
    { value: '計時', label: { zh: '計時', en: 'Part-time (hourly)', vi: 'Bán thời gian (theo giờ)' }, category: 'hourly' },
    { value: '店長', label: { zh: '店長', en: 'Store manager', vi: 'Cửa hàng trưởng' }, category: 'fulltime' },
    { value: '儲備幹部', label: { zh: '儲備幹部', en: 'Management trainee', vi: 'Quản lý dự bị' }, category: 'fulltime' },
  ],
  office: [
    { value: '研發', label: { zh: '研發', en: 'R&D', vi: 'Nghiên cứu phát triển' } },
    { value: '行銷', label: { zh: '行銷', en: 'Marketing', vi: 'Marketing' } },
    { value: '行政', label: { zh: '行政', en: 'Administration', vi: 'Hành chính' } },
    { value: '會計', label: { zh: '會計', en: 'Accounting', vi: 'Kế toán' } },
    { value: '外務', label: { zh: '外務', en: 'Field staff', vi: 'Nhân viên đối ngoại' } },
    { value: '工程', label: { zh: '工程', en: 'Engineering', vi: 'Kỹ thuật' } },
    { value: '特助', label: { zh: '特助', en: 'Special assistant', vi: 'Trợ lý đặc biệt' } },
    { value: '稽核', label: { zh: '稽核', en: 'Audit', vi: 'Kiểm toán nội bộ' } },
  ],
  factory: [
    { value: '管理', label: { zh: '管理', en: 'Management', vi: 'Quản lý' }, category: 'fulltime' },
    { value: '行政', label: { zh: '行政', en: 'Administration', vi: 'Hành chính' }, category: 'fulltime' },
    { value: '正職', label: { zh: '正職', en: 'Full-time', vi: 'Nhân viên chính thức' }, category: 'fulltime' },
    { value: '計時', label: { zh: '計時', en: 'Part-time (hourly)', vi: 'Bán thời gian (theo giờ)' }, category: 'hourly' },
  ],
}
// 門市與辦公室另有「其他」（自行填寫）
export const HAS_OTHER: Record<UnitKind, boolean> = { store: true, office: true, factory: false }

export interface UnitOption { kind: UnitKind; value: string; name: string }

export const labelOf = (l: L, locale: string) => locale.startsWith('vi') ? l.vi : locale.startsWith('en') ? l.en : l.zh

export function unitKindOf(units: UnitOption[], store: string): UnitKind | null {
  if (!store) return null
  return units.find(u => u.value === store)?.kind ?? null
}

export function categoryFor(kind: UnitKind | null, position: string): '' | 'fulltime' | 'hourly' {
  if (!kind) return ''
  return POSITIONS[kind].find(p => p.value === position)?.category ?? ''
}
