import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 列出我目前所屬（active）的所有公司，供切換器顯示。
// 一個帳號現在可以同時是多家公司的一般成員（owner 除外，owner 仍一人限一家）。
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 自動接受 email 相符的待處理公司邀請
  await supabase.rpc('claim_company_invitations')

  const admin = createAdminClient()
  const { data: memberships, error } = await admin.from('company_members')
    .select('company_id, role, companies(id, name, bnb_owner_id)')
    .eq('member_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    self: { id: user.id, email: user.email },
    memberships: (memberships ?? []).map((m) => {
      const company = Array.isArray(m.companies) ? m.companies[0] : m.companies
      return { company_id: m.company_id, role: m.role, company_name: company?.name ?? null, bnb_owner_id: company?.bnb_owner_id ?? null }
    }),
  })
}
