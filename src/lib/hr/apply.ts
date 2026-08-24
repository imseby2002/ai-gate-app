import { randomBytes } from 'crypto'

export const APPLY_BUCKET = 'hr-candidate-docs'

// 紙本繳交型態：正本 / 影印本 / 兩者
export type CopyKind = 'original' | 'copy' | 'both'
export const COPY_LABEL: Record<CopyKind, string> = {
  original: '正本', copy: '影印本', both: '正本＋影印本',
}
// recruit＝勞動檔案、insurance＝保險檔案、tax＝所得稅檔案
export type DocCategory = 'recruit' | 'insurance' | 'tax'
export const CATEGORY_LABEL: Record<DocCategory, string> = {
  recruit: '勞動檔案', insurance: '保險檔案', tax: '所得稅檔案',
}

export interface DocSpec {
  type: string
  label: string
  copy: CopyKind          // 紙本需繳型態
  categories: DocCategory[] // 勞動 / 保險 / 所得稅
}

// 完整文件目錄（依 HO_SO_NHAN_VIEN：勞動＋保險＋所得稅）
// 一次要齊所有日後會用到的檔案，不等到要用時才補件。
export const DOC_CATALOG: DocSpec[] = [
  { type: 'resume',       label: '履歷（公證正本）', copy: 'original', categories: ['recruit', 'insurance'] },
  { type: 'id_card',      label: '公民身分證(CCCD)', copy: 'copy',     categories: ['recruit', 'insurance', 'tax'] },
  { type: 'application',  label: '求職申請書',       copy: 'original', categories: ['recruit'] },
  { type: 'cv',           label: 'CV',               copy: 'copy',     categories: ['recruit'] },
  { type: 'diploma',      label: '學歷／證照／成績單', copy: 'copy',   categories: ['recruit'] },
  { type: 'student_card', label: '學生證',           copy: 'copy',     categories: ['recruit'] },
  { type: 'health',       label: '健康檢查（正本）', copy: 'original', categories: ['recruit', 'insurance'] },
  { type: 'birth',        label: '出生證明',         copy: 'copy',     categories: ['insurance'] },
  { type: 'vneid',        label: 'VNEID（電子身分）', copy: 'copy',    categories: ['insurance', 'tax'] },
  { type: 'residence',    label: '居住證明',         copy: 'copy',     categories: ['insurance'] },
  { type: 'other',        label: '其他',             copy: 'copy',     categories: ['recruit'] },
]

// 相容舊介面
export const APPLY_DOC_TYPES = DOC_CATALOG.map(d => ({ type: d.type, label: d.label }))
export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_CATALOG.map(d => [d.type, d.label]))
export const DOC_COPY: Record<string, CopyKind> = Object.fromEntries(DOC_CATALOG.map(d => [d.type, d.copy]))
export const DOC_TYPE_SET = new Set(DOC_CATALOG.map(d => d.type))

// url-safe 隨機碼
export function genCode(bytes = 6): string {
  return randomBytes(bytes).toString('base64url')
}
export function genToken(): string {
  return randomBytes(24).toString('base64url')
}

// 應徵者可隨時修改的欄位：電話、地址、通知方式（＋文件上傳）
export const FREE_FIELDS = ['phone', 'address', 'notify_channel'] as const
// 重要基本資料：鎖定後需人事開放，應徵者才能修改
export const IDENTITY_FIELDS = ['name', 'email', 'position', 'store', 'id_number', 'birthday'] as const
// 應徵者可能送出的所有欄位
export const APPLICANT_FIELDS = [...FREE_FIELDS, ...IDENTITY_FIELDS] as const
