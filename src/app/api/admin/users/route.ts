import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

interface ManagementAuth {
  user: { id: string; email?: string }
  isSuperAdmin: boolean
  isCompanyAdmin: boolean
  companyId: string | null
}

async function getManagementAuth(): Promise<ManagementAuth | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = await createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('user_type, company_id')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.user_type === 'admin'
  let isCompanyAdmin = false
  const companyId = profile?.company_id ?? null

  if (!isSuperAdmin && companyId) {
    const { data: m } = await adminClient
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  if (!isSuperAdmin && !isCompanyAdmin) return null

  return {
    user,
    isSuperAdmin,
    isCompanyAdmin,
    companyId,
  }
}

export async function GET() {
  const auth = await getManagementAuth()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createAdminClient()
  let query = supabase
    .from('profiles')
    .select('*, subscriptions(plan_id, status)')
    .order('created_at', { ascending: false })

  // 公司負責人或 IT：僅讀取本公司成員名單
  if (!auth.isSuperAdmin && auth.companyId) {
    query = query.eq('company_id', auth.companyId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await getManagementAuth()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { userId, ...updates } = body

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const supabase = await createAdminClient()

  // 若為公司負責人或 IT，先校驗目標用戶是否為本公司成員
  if (!auth.isSuperAdmin) {
    const { data: targetProf } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single()

    if (!targetProf || targetProf.company_id !== auth.companyId) {
      return NextResponse.json({ error: '無權限修改其他公司成員' }, { status: 403 })
    }
    // 公司管理者不可修改 user_type 或 monthly_budget
    delete updates.user_type
    delete updates.monthly_budget
  }

  // Only allow safe field updates
  const allowedFields = ['is_active', 'user_type', 'monthly_budget', 'department', 'enabled_modules', 'units']
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowedFields.includes(k))
  )

  const { error } = await supabase
    .from('profiles')
    .update(safeUpdates)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
