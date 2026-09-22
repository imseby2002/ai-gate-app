import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_BNB_COOKIE } from '@/lib/bnb/context'
import { ACTIVE_COMPANY_COOKIE } from '@/lib/company/activeCompany'

async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 這個 ownerId 是否剛好是某家公司掛的訂房/客服帳號、而且自己是那家公司的 active 成員
// （總管理員代操不需 membership，比照 /api/company/active-company 的規則）？
// 是的話連動切公司 cookie；不是的話清掉（避免殘留另一家公司的 ERP 狀態）。
// 跟 /api/company/active-company 反向對稱，確保兩顆 cookie 不會切出不一致的組合。
async function matchingCompanyId(userId: string, ownerId: string, isSuperAdmin: boolean): Promise<string | null> {
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('id').eq('bnb_owner_id', ownerId).maybeSingle()
  if (!company) return null
  if (isSuperAdmin) return company.id
  const { data: member } = await admin.from('company_members')
    .select('id').eq('company_id', company.id).eq('member_id', userId).eq('status', 'active').maybeSingle()
  return member ? company.id : null
}

// 切換目前要管理哪一間民宿
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId } = await req.json()
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, ...(domain ? { domain } : {}) }
  const clearOpts = { ...opts, maxAge: 0 }

  // 切回自己：訂房/客服 cookie 明確指回自己（不能只清掉——清掉會落到 getBnbContext
  // 的「純協作者自動判定」，如果你剛好是別人的協作者又沒有自己的房源，會被悄悄帶回
  // 那個業務，跟你剛選的「我自己的帳號」不一致）。公司 cookie 清掉即可，它的退回邏輯
  // 是固定的 profiles.company_id，不是像 bnb 這種帶搜尋性質的自動判定，沒有這個風險。
  if (!ownerId || ownerId === user.id) {
    cookieStore.set(ACTIVE_BNB_COOKIE, user.id, opts)
    cookieStore.set(ACTIVE_COMPANY_COOKIE, '', clearOpts)
    return NextResponse.json({ ownerId: user.id, role: 'owner' })
  }

  // 總管理員代操：admin 可切換到任何 owner（不需 membership），用於協助設定代操
  const { data: me } = await supabase.from('profiles').select('user_type').eq('id', user.id).maybeSingle()
  if (me?.user_type === 'admin') {
    cookieStore.set(ACTIVE_BNB_COOKIE, ownerId, opts)
    const companyId = await matchingCompanyId(user.id, ownerId, true)
    if (companyId) cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, opts)
    else cookieStore.set(ACTIVE_COMPANY_COOKIE, '', clearOpts)
    return NextResponse.json({ ownerId, role: 'admin' })
  }

  // 驗證對該 owner 有 active membership（任一模組即可切換；可能有 booking/cs 多列）
  const { data: members } = await supabase
    .from('bnb_members')
    .select('role')
    .eq('owner_id', ownerId)
    .eq('member_id', user.id)
    .eq('status', 'active')

  const member = members?.[0]
  if (!member) return NextResponse.json({ error: '無權管理此民宿' }, { status: 403 })

  cookieStore.set(ACTIVE_BNB_COOKIE, ownerId, opts)
  const companyId = await matchingCompanyId(user.id, ownerId, false)
  if (companyId) cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, opts)
  else cookieStore.set(ACTIVE_COMPANY_COOKIE, '', clearOpts)
  return NextResponse.json({ ownerId, role: member.role })
}
