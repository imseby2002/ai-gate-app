// 智慧圓桌扣點：會後依實際模型用量扣點（見 lib/ai/roundtable.ts 的 roundtableUsage）。
// 加成比照行銷模組（lib/marketing/billing.ts：依實際 API 成本 ×3 左右加成）。
// 只對付費客戶（user_type === 'external'）扣點，admin／employee 不計費。
import { deductCredits, getBalance } from '@/lib/skills/billing'

export const ROUNDTABLE_MARKUP = 3

export async function chargeRoundtable(
  userId: string,
  userType: string | null | undefined,
  costUsd: number,
  sessionId: string,
): Promise<void> {
  if (userType !== 'external' || costUsd <= 0) return
  const amount = Number((costUsd * ROUNDTABLE_MARKUP).toFixed(4))
  const description = `roundtable:${sessionId}`
  const result = await deductCredits(userId, amount, description)
  if (result.ok) return
  if (result.reason === 'insufficient') {
    // 會議已產出內容，餘額不足時扣到 0，不讓帳戶出現負數
    const balance = await getBalance(userId)
    if (balance > 0) await deductCredits(userId, balance, `${description}（餘額不足，扣至 0）`)
    return
  }
  console.error('[roundtable-billing] 扣點失敗', { userId, sessionId, amount })
}
