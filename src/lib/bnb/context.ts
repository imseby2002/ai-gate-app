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
  /** owner / admin 可改設定（房源、定價規則、通路、模板…）；manager 不可 */
  canSettings: boolean
  /** owner 一律可以；協作者需要 owner 額外勾選 can_correct_ai 才能直接送出「AI 回答修正」 */
  canCorrectAi: boolean
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * 解析當前請求要操作哪一間民宿。
 * - 未設 cookie 或 cookie = 自己 → 操作自己的民宿（owner）
 * - cookie 指向他人 → 驗證對該 owner 有 active membership，取得角色
 *   驗證失敗則安全退回自己的民宿
 */
export async function getBnbContext(
  supabase?: SupabaseClient,
  scope: 'booking' | 'cs' = 'booking'
): Promise<BnbContext | null> {
  const sb = supabase ?? (await createClient())
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const requested = cookieStore.get(ACTIVE_BNB_COOKIE)?.value

  const selfCtx = (): BnbContext => ({
    user, ownerId: user.id, role: 'owner', isOwner: true, canWrite: true, canSettings: true, canCorrectAi: true,
  })
  const memberCtx = (ownerId: string, role: BnbRole, canCorrectAi = false): BnbContext => ({
    user, ownerId, role, isOwner: false,
    canWrite: role === 'admin' || role === 'manager',
    canSettings: role === 'admin',
    canCorrectAi: (role === 'admin' || role === 'manager') && canCorrectAi,
  })

  // 使用者主動選了自己的民宿
  if (requested === user.id) return selfCtx()

  // 尚未設定切換 cookie：若是「純協作者」（自己沒有任何民宿房型資料、但有受邀的
  // active membership）→ 自動進入受邀民宿，省去手動切換。一旦用切換器選過即寫入
  // cookie，走下方驗證分支，不再自動判定。
  if (!requested) {
    const { data: memberships } = await sb
      .from('bnb_members')
      .select('owner_id, role, can_correct_ai')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .eq('scope', scope)
      .order('created_at', { ascending: true })

    if (memberships?.length) {
      const { count } = await sb
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (!count) return memberCtx(memberships[0].owner_id, memberships[0].role as BnbRole, memberships[0].can_correct_ai)
    }
    return selfCtx()
  }

  // 總管理員代操：admin 可切換到任何 owner（不需 membership），用於「協助設定」
  // 代客戶設定 CS。以 owner 等級權限操作（可寫、可改設定）。
  const { data: me } = await sb.from('profiles').select('user_type').eq('id', user.id).maybeSingle()
  if (me?.user_type === 'admin') {
    return { user, ownerId: requested, role: 'admin', isOwner: false, canWrite: true, canSettings: true, canCorrectAi: true }
  }

  // requested 指向他人 → 依模組（scope）驗證協作授權：booking 助理未必有 cs 權限，反之亦然
  const { data: member } = await sb
    .from('bnb_members')
    .select('role, status, can_correct_ai')
    .eq('owner_id', requested)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .eq('scope', scope)
    .maybeSingle()

  if (!member) return selfCtx() // 無效的切換目標 → 退回自己的民宿
  return memberCtx(requested, member.role as BnbRole, member.can_correct_ai)
}
