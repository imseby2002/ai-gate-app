import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId } from '@/lib/company/activeCompany'

export type BnbScope = 'booking' | 'cs'

// 訂房與客服各自獨立的協作邀請，切換 cookie 也分開——可以同時「訂房用自己的、
// 客服在幫別家公司代操」，不會互相牽動。舊版共用一顆 cookie，新舊版並存期間
// 讀不到值屬正常（會退回自己／公司預設)，不需要遷移舊 cookie。
export function activeBnbCookieName(scope: BnbScope): string {
  return scope === 'booking' ? 'active_bnb_owner_booking' : 'active_bnb_owner_cs'
}

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
 * 解析當前請求要操作哪一間民宿／商戶客服。
 * - 未設 cookie 或 cookie = 自己 → 操作自己的民宿（owner）
 * - cookie 指向他人 → 驗證對該 owner 有 active membership，取得角色
 *   驗證失敗則安全退回自己的民宿
 */
export async function getBnbContext(
  supabase?: SupabaseClient,
  scope: BnbScope = 'booking'
): Promise<BnbContext | null> {
  const sb = supabase ?? (await createClient())
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const requested = cookieStore.get(activeBnbCookieName(scope))?.value

  const selfCtx = (): BnbContext => ({
    user, ownerId: user.id, role: 'owner', isOwner: true, canWrite: true, canSettings: true, canCorrectAi: true,
  })
  const memberCtx = (ownerId: string, role: BnbRole, canCorrectAi = false): BnbContext => ({
    user, ownerId, role, isOwner: false,
    canWrite: role === 'admin' || role === 'manager',
    canSettings: role === 'admin',
    canCorrectAi: (role === 'admin' || role === 'manager') && canCorrectAi,
  })

  // 檢查是否有正在操作中的公司身分（active_company_id）
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id, user_type').eq('id', user.id).maybeSingle()
  const isSuperAdmin = profile?.user_type === 'admin'
  const activeCompId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)

  // 使用者選了自己的民宿（或切換公司時殘留舊 cookie）：
  // 若目前正處於某間公司身分，且該公司有其專屬業務主帳號（非自己），以公司業務為準
  if (requested === user.id) {
    if (activeCompId) {
      let { data: comp } = await admin.from('companies').select('id, bnb_owner_id').eq('id', activeCompId).maybeSingle()
      let companyOwnerId = comp?.bnb_owner_id
      if (!companyOwnerId) {
        const { data: members } = await admin.from('company_members')
          .select('member_id, role').eq('company_id', activeCompId).eq('status', 'active')
        const otherOwner = members?.find(m => m.role === 'owner' && m.member_id !== user.id)
        if (otherOwner?.member_id) {
          companyOwnerId = otherOwner.member_id
        } else {
          const memberIds = (members ?? []).map(m => m.member_id).filter(Boolean) as string[]
          if (memberIds.length > 0) {
            const { data: credRow } = await admin.from('social_platform_credentials')
              .select('user_id').in('user_id', memberIds).eq('platform', 'line').eq('is_connected', true).maybeSingle()
            if (credRow?.user_id) companyOwnerId = credRow.user_id
          }
        }
        if (companyOwnerId && comp?.id) {
          await admin.from('companies').update({ bnb_owner_id: companyOwnerId }).eq('id', comp.id)
        }
      }

      if (companyOwnerId && companyOwnerId !== user.id) {
        const { data: cm } = await admin.from('company_members')
          .select('role').eq('company_id', activeCompId).eq('member_id', user.id).eq('status', 'active').maybeSingle()
        if (cm) {
          const role = (cm.role === 'owner' ? 'admin' : cm.role) as BnbRole
          return memberCtx(companyOwnerId, role, role === 'admin' || role === 'manager')
        }
      }
    }
    return selfCtx()
  }

  // 尚未設定切換 cookie：若是「純協作者」（自己沒有任何民宿房型或 CS 客戶資料、但有受邀的
  // active membership）→ 自動進入受邀民宿／商戶，省去手動切換。一旦用切換器選過即寫入
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
      if (scope === 'booking') {
        const { count } = await sb
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        if (!count) return memberCtx(memberships[0].owner_id, memberships[0].role as BnbRole, memberships[0].can_correct_ai)
      } else {
        const { count } = await sb
          .from('cs_customers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        if (!count) return memberCtx(memberships[0].owner_id, memberships[0].role as BnbRole, memberships[0].can_correct_ai)
      }
    }

    // 若在 bnb_members 未找到，再檢查公司身分（company_members）。
    // 已加入公司的員工，預設一律是公司的業務——不是個人帳號，跟有沒有自己的房源/客戶
    // 無關（不像上面純協作者才需要用「自己有沒有資料」去猜要不要自動代入）；
    // 除非本人自己手動切換 cookie，才會改成別的。
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('company_id, user_type').eq('id', user.id).maybeSingle()
    const isSuperAdmin = profile?.user_type === 'admin'
    const activeCompId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)
    if (activeCompId) {
      const [{ data: company }, { data: cm }, { data: companyOwnerMember }] = await Promise.all([
        admin.from('companies').select('created_by, bnb_owner_id').eq('id', activeCompId).maybeSingle(),
        admin.from('company_members').select('role').eq('company_id', activeCompId).eq('member_id', user.id).eq('status', 'active').maybeSingle(),
        admin.from('company_members').select('member_id').eq('company_id', activeCompId).eq('role', 'owner').eq('status', 'active').maybeSingle(),
      ])
      const companyOwnerId = company?.bnb_owner_id || companyOwnerMember?.member_id || company?.created_by
      if (companyOwnerId && companyOwnerId !== user.id && cm) {
        const role = (cm.role === 'owner' ? 'admin' : cm.role) as BnbRole
        const canCorrectAi = role === 'admin' || role === 'manager'

        // 背景確保同步至 bnb_members（以利 Postgres RLS accessible_owner_ids 順利放行）
        admin.from('bnb_members').upsert({
          owner_id: companyOwnerId,
          member_id: user.id,
          invited_email: user.email,
          role,
          status: 'active',
          scope,
          can_correct_ai: canCorrectAi,
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'owner_id,invited_email,scope' }).then(() => {}, () => {})

        return memberCtx(companyOwnerId, role, canCorrectAi)
      }
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

  if (member) return memberCtx(requested, member.role as BnbRole, member.can_correct_ai)

  // 亦支援以公司成員身分切換
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id, user_type').eq('id', user.id).maybeSingle()
  const isSuperAdmin = profile?.user_type === 'admin'
  const activeCompId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)
  if (activeCompId) {
    const [{ data: company }, { data: cm }, { data: companyOwnerMember }] = await Promise.all([
      admin.from('companies').select('created_by, bnb_owner_id').eq('id', activeCompId).maybeSingle(),
      admin.from('company_members').select('role').eq('company_id', activeCompId).eq('member_id', user.id).eq('status', 'active').maybeSingle(),
      admin.from('company_members').select('member_id').eq('company_id', activeCompId).eq('role', 'owner').eq('status', 'active').maybeSingle(),
    ])
    const companyOwnerId = company?.bnb_owner_id || companyOwnerMember?.member_id || company?.created_by
    if (companyOwnerId === requested && cm) {
      const role = (cm.role === 'owner' ? 'admin' : cm.role) as BnbRole
      const canCorrectAi = role === 'admin' || role === 'manager'

      // 背景確保同步至 bnb_members
      admin.from('bnb_members').upsert({
        owner_id: companyOwnerId,
        member_id: user.id,
        invited_email: user.email,
        role,
        status: 'active',
        scope,
        can_correct_ai: canCorrectAi,
        accepted_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,invited_email,scope' }).then(() => {}, () => {})

      return memberCtx(requested, role, canCorrectAi)
    }
  }

  return selfCtx() // 無效的切換目標 → 退回自己的民宿
}
