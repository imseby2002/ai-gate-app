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

// 完整文件目錄（嚴格對接越南勞動法與門市必備 7 大文件清單＋常規檔案）
export const DOC_CATALOG: DocSpec[] = [
  { type: 'cccd_notarized', label: 'CCCD公證影本 (Bản sao công chứng CCCD - 2份)', copy: 'both', categories: ['recruit', 'insurance', 'tax'] },
  { type: 'curriculum_vitae', label: '個人履歷自傳表 (Sơ yếu lý lịch - 需人委會蓋章)', copy: 'original', categories: ['recruit', 'insurance'] },
  { type: 'health_cert', label: '餐飲體檢證明 (Giấy khám sức khỏe - 通報32/2023二級醫院)', copy: 'original', categories: ['recruit', 'insurance'] },
  { type: 'bank_account', label: 'TPBank 銀行帳戶存摺/截圖 (Thông tin tài khoản ngân hàng)', copy: 'copy', categories: ['recruit'] },
  { type: 'tax_bhxh', label: '個人稅號與社保代碼 (Mã số thuế MST & Mã số BHXH)', copy: 'copy', categories: ['insurance', 'tax'] },
  { type: 'residence_proof', label: '居住證明 CT07/CT08 (Giấy xác nhận thông tin cư trú)', copy: 'copy', categories: ['insurance'] },
  { type: 'photo_id', label: '大頭照 3x4 / 4x6 (Ảnh 3x4 hoặc 4x6製作工卡)', copy: 'original', categories: ['recruit'] },
  // 相容歷史既有選項
  { type: 'id_card', label: '身分證 (CCCD 正反面)', copy: 'copy', categories: ['recruit'] },
  { type: 'resume', label: '應徵履歷表 (CV)', copy: 'copy', categories: ['recruit'] },
  { type: 'diploma', label: '學歷／證照／成績單 (Bằng cấp)', copy: 'copy', categories: ['recruit'] },
  { type: 'other', label: '其他補充文書 (Khác)', copy: 'copy', categories: ['recruit'] },
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
