import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_BNB_COOKIE = 'active_bnb_owner'

export type BnbRole = 'owner' | 'admin' | 'manager' | 'viewer'

export interface BnbContext {
  user: User
  /** 當前操作的民宿擁有者 id；所有民宿資料的 user_id 都對應這個值 */
  ownerId: string
  role: BnbRole
  isOwner: boolean
  /** owner / admin / manager 可寫，viewer 唯讀 */
  canWrite: boolean
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * 解析當前請求要操作哪一間民宿。
 * - 未設 cookie 或 cookie = 自己 → 操作自己的民宿（owner）
 * - cookie 指向他人 → 驗證對該 owner 有 active membership，取得角色
 *   驗證失敗則安全退回自己的民宿
 */
export async function getBnbContext(
  supabase?: SupabaseClient
): Promise<BnbContext | null> {
  const sb = supabase ?? (await createClient())
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const requested = cookieStore.get(ACTIVE_BNB_COOKIE)?.value

  if (!requested || requested === user.id) {
    return { user, ownerId: user.id, role: 'owner', isOwner: true, canWrite: true }
  }

  const { data: member } = await sb
    .from('bnb_members')
    .select('role, status')
    .eq('owner_id', requested)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!member) {
    // 無效的切換目標 → 退回自己的民宿
    return { user, ownerId: user.id, role: 'owner', isOwner: true, canWrite: true }
  }

  const role = member.role as BnbRole
  return {
    user,
    ownerId: requested,
    role,
    isOwner: false,
    canWrite: role === 'admin' || role === 'manager',
  }
}
