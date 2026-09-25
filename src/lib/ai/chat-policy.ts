// CHAT 免費政策：付費客戶（user_type === 'external'）的 CHAT 不扣點，
// 改以「只開放免費／低價模型」＋「每日則數上限」控制成本；生圖／影片不在 CHAT 提供。
// admin / employee 內部帳號不受此限制。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// 開放給付費客戶的模型：Groq 系列（成本表記為 0）與每千 tokens 低於 $0.001 的模型
const ALLOWED_PREFIXES = ['groq-']
const ALLOWED_MODELS = new Set([
  'gemini-3.0-flash',
  'gemini-3.0-flash-thinking',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'deepseek-chat',
])

export function isChatModelAllowed(modelId: string | null | undefined): boolean {
  if (!modelId) return false
  return ALLOWED_MODELS.has(modelId) || ALLOWED_PREFIXES.some(p => modelId.startsWith(p))
}

/** 每人每日可送出的 CHAT 則數：個人帳號 20、公司成員 100 */
export const CHAT_DAILY_LIMIT = { personal: 20, company: 100 } as const

/**
 * 今日（UTC+8）已送出的使用者訊息數與上限。
 * 以 messages 表 role='user' 計數，不另建計數表。
 */
export async function getChatDailyUsage(
  supabase: SupabaseClient,
  userId: string,
  hasCompany: boolean,
): Promise<{ used: number; limit: number }> {
  const limit = hasCompany ? CHAT_DAILY_LIMIT.company : CHAT_DAILY_LIMIT.personal
  // 以台灣／越南使用者為主，日界採 UTC+8 午夜
  const now = new Date()
  const shifted = new Date(now.getTime() + 8 * 3600_000)
  const startUtc = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 3600_000)

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', startUtc.toISOString())
  // 查詢失敗視同已達上限（fail-closed），並留下紀錄
  if (error) {
    console.error('[chat-policy] 每日則數查詢失敗', { userId, error })
    return { used: limit, limit }
  }
  return { used: count ?? 0, limit }
}
