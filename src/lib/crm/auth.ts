import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId, resolveCompanyOwner } from '@/lib/company/activeCompany'
import { ownerFilter } from './scope'

/** 平台範圍（eSIM 商店客人）：owner_id 為 null，只有總管理員可存取 */
export const PLATFORM_SCOPE = 'platform'

/**
 * 客戶系統 API 共用身分驗證：未登入 401、停用 403。
 * 客人資料以「公司」為範圍：ownerId = 目前操作中公司的 owner 帳號（個人帳號＝自己）；
 * 總管理員帶 ?scope=platform 時 ownerId = null（平台範圍）。
 * 權限已在這裡判定，之後一律用 service role client 並明確帶 owner 篩選。
 */
export async function getCrmUser(req?: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '未登入' }, { status: 401 }) } as const
  const supabase = createAdminClient() as SupabaseClient
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profile?.is_active === false) {
    return { error: NextResponse.json({ error: '帳號已停用' }, { status: 403 }) } as const
  }
  const isAdmin = profile?.user_type === 'admin'
  // 範圍一律跟著右上角目前選的公司；唯一例外是 eSIM 管理頁連過來的 ?scope=platform（只有總管理員）
  const scope = req?.nextUrl.searchParams.get('scope') ?? ''
  if (scope && (scope !== PLATFORM_SCOPE || !isAdmin)) {
    return { error: NextResponse.json({ error: '沒有這個範圍的權限' }, { status: 403 }) } as const
  }
  let ownerId: string | null = null
  let companyId: string | null = null
  if (scope === PLATFORM_SCOPE) {
    ownerId = null
  } else {
    companyId = await resolveActiveCompanyId(supabase as never, user.id, isAdmin, (profile?.company_id as string | null) ?? null)
    ownerId = (await resolveCompanyOwner(supabase as never, companyId)) ?? user.id
  }

  // 權限：總管理員、公司負責人（或個人帳號自己）、公司管理員 = manage；其他成員要由前者在客戶系統開通 view / edit
  let access: CrmAccess | null = null
  if (isAdmin || ownerId === user.id) access = 'manage'
  if (!access && companyId) {
    const { data: cm } = await supabase.from('company_members').select('role')
      .eq('company_id', companyId).eq('member_id', user.id).eq('status', 'active').maybeSingle()
    if (cm?.role === 'owner' || cm?.role === 'admin') access = 'manage'
  }
  if (!access && ownerId) {
    const { data: grant } = await supabase.from('crm_access').select('role')
      .eq('owner_id', ownerId).eq('member_id', user.id).maybeSingle()
    if (grant?.role === 'edit' || grant?.role === 'view') access = grant.role
  }
  if (!access) {
    return { error: NextResponse.json({ error: '沒有客戶系統權限，請公司負責人或管理員到客戶系統的「權限設定」開通' }, { status: 403 }) } as const
  }
  return { supabase, user, isAdmin, ownerId, companyId, access, own: ownerFilter(ownerId) } as const
}

export type CrmAccess = 'manage' | 'edit' | 'view'

/** 寫入類操作（新增、編輯、綁定、合併、同步）需要 edit 以上 */
export function denyIfReadOnly(access: CrmAccess): NextResponse | null {
  return access === 'view' ? NextResponse.json({ error: '你的客戶系統權限是「只能查看」' }, { status: 403 }) : null
}
