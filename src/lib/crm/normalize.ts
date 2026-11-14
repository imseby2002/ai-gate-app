// 客戶系統（CRM）身分正規化：讓不同系統寫入的同一支電話 / Email / 平台帳號能比對成同一人。

export type IdentityKind =
  | 'line' | 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'zalo' | 'wechat'
  | 'phone' | 'email' | 'other'

export const IDENTITY_KINDS: { id: IdentityKind; label: string }[] = [
  { id: 'line', label: 'LINE' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'zalo', label: 'Zalo' },
  { id: 'wechat', label: 'WeChat' },
  { id: 'phone', label: '電話' },
  { id: 'email', label: 'Email' },
  { id: 'other', label: '其他' },
]

/** 電話只留數字；台灣 09xxxxxxxx → 8869xxxxxxxx；越南 0xxxxxxxxx 保持原樣（無法判斷國別） */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (/^09\d{8}$/.test(d)) d = '886' + d.slice(1)
  if (/^8860\d{9}$/.test(d)) d = '886' + d.slice(4)
  return d.length >= 7 && d.length <= 15 ? d : null
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** 客服 cs_customers.platform → CRM 身分類型 */
export function csPlatformToKind(platform: string): IdentityKind | null {
  const p = platform.toLowerCase()
  if (p === 'line' || p === 'line-oa' || p === 'line_oa') return 'line'
  if (p.startsWith('whatsapp')) return 'whatsapp'
  if (p === 'messenger' || p === 'facebook') return 'messenger'
  if (p === 'instagram') return 'instagram'
  if (p === 'telegram') return 'telegram'
  if (p.startsWith('zalo')) return 'zalo'
  if (p === 'wechat') return 'wechat'
  return null
}

export function normalizeIdentity(kind: string, value: unknown): string | null {
  if (kind === 'phone' || kind === 'whatsapp') return normalizePhone(value)
  if (kind === 'email') return normalizeEmail(value)
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v.slice(0, 200) : null
}
