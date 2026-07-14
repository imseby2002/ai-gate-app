// resume / work 模組 AI 工具的計費與存取守衛
// 比照 skills（api/skills/run）：模組權限 + 執行前餘額檢查，計價共用 skills/billing。
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBalance } from '@/lib/skills/billing'

// 各工具固定扣點（單位與 credit_transactions.amount_usd 相同）
export const RESUME_COSTS = {
  'resume-optimize': 0.05, // 兩階段（分析 + 撰寫），較重
  'cover-letter': 0.02,
  'worker-tools': 0.02,
} as const

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// 認證後的模組權限 + 餘額檢查。
// 通過回傳 null；未通過回傳可直接 return 的 Response（401/403/402）。
export async function guardResumeAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  cost: number,
): Promise<Response | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active, enabled_modules')
    .eq('id', userId)
    .single()

  if (!profile) return json({ error: 'Unauthorized' }, 401)
  if (profile.is_active === false) return json({ error: '帳號已停用' }, 403)

  // 模組權限：admin 全開，其他看 enabled_modules（比照 skills/run 的預設）
  if (profile.user_type !== 'admin') {
    const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']
    if (!enabled.includes('resume')) {
      return json({ error: '未開通模組：resume' }, 403)
    }
  }

  // 執行前餘額檢查
  const balance = await getBalance(userId)
  if (balance < cost) {
    return json({ error: '點數不足', balance, required: cost }, 402)
  }

  return null
}
