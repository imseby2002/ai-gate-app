import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 目前登入者可存取的單位與管理權限（供 /office 入口與人員權限指派使用）。
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type, units, company_id')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.user_type === 'admin'
  let isCompanyAdmin = false
  let companyRole: string | null = null
  let companyName: string | null = null

  if (profile?.company_id) {
    const [{ data: m }, { data: c }] = await Promise.all([
      admin.from('company_members')
        .select('role')
        .eq('company_id', profile.company_id)
        .eq('member_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      admin.from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
    ])
    companyRole = m?.role ?? null
    companyName = c?.name ?? null
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  const canManage = isSuperAdmin || isCompanyAdmin

  return NextResponse.json({
    isAdmin: isSuperAdmin,
    isCompanyAdmin,
    canManage,
    companyRole,
    companyName,
    units: profile?.units ?? [],
  })
}
