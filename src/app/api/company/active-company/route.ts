import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'
import { ACTIVE_COMPANY_COOKIE } from '@/lib/company/activeCompany'
import { activeBnbCookieName } from '@/lib/bnb/context'

async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 切換目前操作身分（ERP 側：CS/Booking/HR/Finance/行銷全部一起切，代表整個公司的預設）。
// 公司若有綁定訂房/客服帳號（companies.bnb_owner_id），連動把訂房與客服的預設都設過去；
// 沒有掛的話明確指回自己。這只是設定「預設值」——訂房/客服各自的單獨受邀協作
// （/team 頁「客服協作邀請」「訂房協作邀請」）仍然獨立，不會被這裡蓋掉。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId } = await req.json() as { companyId?: string | null }
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, ...(domain ? { domain } : {}) }
  const clearOpts = { ...opts, maxAge: 0 }

  // 切回個人身分：公司 cookie 清掉；訂房/客服 cookie 明確指回自己（不能只清掉——
  // 清掉會落到 getBnbContext 的「純協作者自動判定」，若你剛好是別人的協作者又沒有
  // 自己的房源，會被悄悄帶回那個業務，跟你剛選的「個人身分」不一致）。
  if (!companyId) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, '', clearOpts)
    cookieStore.set(activeBnbCookieName('booking'), user.id, opts)
    cookieStore.set(activeBnbCookieName('cs'), user.id, opts)
    return NextResponse.json({ companyId: null })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, email').eq('id', user.id).maybeSingle()
  const isSuperAdmin = isSuperAdminUser(user, profile)

  let role = 'admin'
  if (!isSuperAdmin) {
    const { data: member } = await admin.from('company_members')
      .select('role').eq('company_id', companyId).eq('member_id', user.id).eq('status', 'active').maybeSingle()
    if (!member) return NextResponse.json({ error: '無權操作此公司' }, { status: 403 })
    role = member.role
  }

  const { data: company } = await admin.from('companies').select('bnb_owner_id').eq('id', companyId).maybeSingle()

  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, opts)
  // 這家公司有掛訂房/客服帳號 → 連動切過去；沒有的話明確指回自己（理由同上，不能只清掉）
  const bnbDefault = company?.bnb_owner_id || user.id
  cookieStore.set(activeBnbCookieName('booking'), bnbDefault, opts)
  cookieStore.set(activeBnbCookieName('cs'), bnbDefault, opts)

  return NextResponse.json({ companyId, role })
}
