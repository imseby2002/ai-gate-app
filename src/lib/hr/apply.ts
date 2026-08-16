import { randomBytes } from 'crypto'

export const APPLY_BUCKET = 'hr-candidate-docs'

// 求職文件清單（依 HO_SO_NHAN_VIEN 求職資料）
export const APPLY_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'resume', label: '履歷' },
  { type: 'id_card', label: '身分證' },
  { type: 'application', label: '求職申請' },
  { type: 'cv', label: 'CV' },
  { type: 'diploma', label: '畢業證／學生證' },
  { type: 'health', label: '健康證明' },
  { type: 'birth', label: '出生證明' },
  { type: 'other', label: '其他' },
]
export const DOC_LABEL: Record<string, string> = Object.fromEntries(
  APPLY_DOC_TYPES.map(d => [d.type, d.label]),
)
export const DOC_TYPE_SET = new Set(APPLY_DOC_TYPES.map(d => d.type))

// url-safe 隨機碼
export function genCode(bytes = 6): string {
  return randomBytes(bytes).toString('base64url')
}
export function genToken(): string {
  return randomBytes(24).toString('base64url')
}

// 應徵者可隨時修改的欄位：電話、地址（＋文件上傳）
export const FREE_FIELDS = ['phone', 'address'] as const
// 重要基本資料：鎖定後需人事開放，應徵者才能修改
export const IDENTITY_FIELDS = ['name', 'email', 'position', 'store', 'id_number', 'birthday'] as const
// 應徵者可能送出的所有欄位
export const APPLICANT_FIELDS = [...FREE_FIELDS, ...IDENTITY_FIELDS] as const
