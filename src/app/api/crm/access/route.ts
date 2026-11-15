import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'

// 客戶系統權限設定（公司負責人／公司管理員／總管理員）
// GET  /api/crm/access → 公司成員清單與各自的客戶系統權限
// PUT  /api/crm/access { member_id, role: 'none' | 'view' | 'edit' }
export async function GET(req: NextRequest) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  const { supabase, ownerId, companyId, access } = auth
  if (access !== 'manage') return NextResponse.json({ error: '只有公司負責人或管理員可以設定權限' }, { status: 403 })
  if (!ownerId || !companyId) return NextResponse.json({ members: [], note: '個人帳號或平台範圍沒有其他成員可授權' })

  const { data: members } = await supabase.from('company_members')
    .select('member_id, role, profiles!company_members_member_id_fkey(full_name, email)')
    .eq('company_id', companyId).eq('status', 'active')
  const { data: grants } = await supabase.from('crm_access').select('member_id, role').eq('owner_id', ownerId)
  const grantMap = new Map((grants ?? []).map(g => [g.member_id as string, g.role as string]))
  const list = (members ?? []).map(m => {
    const p = m.profiles as unknown as { full_name: string | null; email: string | null } | null
    const builtIn = m.role === 'owner' || m.role === 'admin'
    return {
      member_id: m.member_id as string,
      name: p?.full_name || p?.email?.split('@')[0] || '',
      email: p?.email ?? '',
      company_role: m.role as string,
      crm_role: builtIn ? 'manage' : (grantMap.get(m.member_id as string) ?? 'none'),
      built_in: builtIn,
    }
  }).sort((a, b) => Number(b.built_in) - Number(a.built_in) || a.name.localeCompare(b.name))
  return NextResponse.json({ members: list })
}

export async function PUT(req: NextRequest) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  const { supabase, user, ownerId, companyId, access } = auth
  if (access !== 'manage') return NextResponse.json({ error: '只有公司負責人或管理員可以設定權限' }, { status: 403 })
  if (!ownerId || !companyId) return NextResponse.json({ error: '個人帳號或平台範圍不能授權' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const memberId = String(body.member_id ?? '')
  const role = String(body.role ?? '')
  if (!['none', 'view', 'edit'].includes(role)) return NextResponse.json({ error: '權限只能是 none / view / edit' }, { status: 400 })

  // 只能授權給同公司的成員
  const { data: cm } = await supabase.from('company_members').select('role')
    .eq('company_id', companyId).eq('member_id', memberId).eq('status', 'active').maybeSingle()
  if (!cm) return NextResponse.json({ error: '這個帳號不是公司成員' }, { status: 400 })
  if (cm.role === 'owner' || cm.role === 'admin') return NextResponse.json({ error: '公司負責人與管理員本來就有完整權限' }, { status: 400 })

  if (role === 'none') {
    const { error } = await supabase.from('crm_access').delete().eq('owner_id', ownerId).eq('member_id', memberId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('crm_access').upsert(
      { owner_id: ownerId, member_id: memberId, role, granted_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,member_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
