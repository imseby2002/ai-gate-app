import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'
import { ACTIVE_COMPANY_COOKIE } from '@/lib/company/activeCompany'

async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 切換目前要操作哪一家公司（ERP 側：CS/Booking/HR/Finance/行銷）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId } = await req.json() as { companyId?: string | null }
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, ...(domain ? { domain } : {}) }

  // 切回個人身分
  if (!companyId) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, '', { ...opts, maxAge: 0 })
    return NextResponse.json({ companyId: null })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, email').eq('id', user.id).maybeSingle()
  const isSuperAdmin = isSuperAdminUser(user, profile)

  // 總管理員代操：可切換到任何公司（不需 membership）
  if (isSuperAdmin) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, opts)
    return NextResponse.json({ companyId, role: 'admin' })
  }

  const { data: member } = await admin.from('company_members')
    .select('role').eq('company_id', companyId).eq('member_id', user.id).eq('status', 'active').maybeSingle()
  if (!member) return NextResponse.json({ error: '無權操作此公司' }, { status: 403 })

  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, opts)
  return NextResponse.json({ companyId, role: member.role })
}
