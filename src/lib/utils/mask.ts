// 敏感個資遮罩（清單／一般查詢用；單筆查詢供編輯時應回傳原始值，不套用此處）
export function maskIdNumber(v: string | null | undefined): string {
  const s = String(v ?? '')
  if (!s) return s
  if (s.length <= 6) return s[0] + '*'.repeat(s.length - 1)
  return s.slice(0, 3) + '*'.repeat(s.length - 6) + s.slice(-3)
}

export function maskBankAccount(v: string | null | undefined): string {
  const s = String(v ?? '')
  if (!s) return s
  if (s.length <= 4) return '*'.repeat(s.length)
  return '*'.repeat(s.length - 4) + s.slice(-4)
}
