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
  if (scope === PLATFORM_SCOPE) {
    ownerId = null
  } else {
    const companyId = await resolveActiveCompanyId(supabase as never, user.id, isAdmin, (profile?.company_id as string | null) ?? null)
    ownerId = (await resolveCompanyOwner(supabase as never, companyId)) ?? user.id
  }
  return { supabase, user, isAdmin, ownerId, own: ownerFilter(ownerId) } as const
}
