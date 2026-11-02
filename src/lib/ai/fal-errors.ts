// fal.ai 額度用完（帳戶被鎖、需儲值）時的錯誤判斷。
// fal 回傳英文原文（例：「User is locked. Reason: TOP_UP」），改回固定代碼，由前端依使用者語言顯示友善提示。
export const AI_QUOTA_CODE = 'AI_QUOTA_EXHAUSTED'

export function isFalQuotaError(err: unknown): boolean {
  const e = err as { message?: unknown; body?: unknown; status?: unknown } | null
  const text = [
    typeof err === 'string' ? err : '',
    typeof e?.message === 'string' ? e.message : '',
    e?.body ? JSON.stringify(e.body) : '',
  ].join(' ')
  return /user is locked|exhausted balance|top_up|insufficient (balance|credit)|balance (is )?(too )?low/i.test(text)
}
