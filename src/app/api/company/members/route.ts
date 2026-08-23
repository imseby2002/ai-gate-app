import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'

const ROLES = ['admin', 'manager', 'viewer'] as const // 不含 owner：owner 轉移不在此路由範圍
type Role = (typeof ROLES)[number]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function profileMap(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return {} as Record<string, { email: string | null; full_name: string | null }>
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('id, email, full_name').in('id', uniq)
  const map: Record<string, { email: string | null; full_name: string | null }> = {}
  for (const p of data ?? []) map[p.id] = { email: p.email, full_name: p.full_name }
  return map
}

// GET /api/company/members — 我所屬公司的完整名冊
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 先認領信箱相符的待接受邀請，比照 bnb_members 的 claim_bnb_invitations() 慣例
  await supabase.rpc('claim_company_invitations')

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ company: null, members: [] })

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('company_members')
    .select('*')
    .eq('company_id', company.companyId)
    .order('created_at', { ascending: true })

  const profiles = await profileMap((members ?? []).map(m => m.member_id).filter(Boolean))
  const list = (members ?? []).map(m => ({
    id: m.id,
    email: m.invited_email,
    role: m.role,
    status: m.status,
    member: m.member_id ? profiles[m.member_id] ?? null : null,
    createdAt: m.created_at,
  }))

  return NextResponse.json({ company, members: list })
}

// POST /api/company/members — 邀請新成員，僅 owner/admin 角色可用
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (company.role !== 'owner' && company.role !== 'admin')
    return NextResponse.json({ error: '僅公司管理者可邀請成員' }, { status: 403 })

  const { email, role } = await req.json() as { email?: string; role?: Role }
  const normEmail = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normEmail)) return NextResponse.json({ error: 'Email 格式錯誤' }, { status: 400 })
  if (normEmail === (user.email ?? '').toLowerCase())
    return NextResponse.json({ error: '不能邀請自己' }, { status: 400 })
  if (!role || !ROLES.includes(role)) return NextResponse.json({ error: '角色錯誤' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('company_members').upsert({
    company_id: company.companyId,
    invited_email: normEmail,
    role,
    invited_by: user.id,
    status: 'pending',
    member_id: null,
    accepted_at: null,
  }, { onConflict: 'company_id,invited_email' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/company/members — 修改成員角色（不可改動 owner 列），僅 owner/admin 角色可用
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (company.role !== 'owner' && company.role !== 'admin')
    return NextResponse.json({ error: '僅公司管理者可修改成員角色' }, { status: 403 })

  const { id, role } = await req.json() as { id?: string; role?: Role }
  if (!id || !role || !ROLES.includes(role)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_members')
    .update({ role })
    .eq('id', id)
    .eq('company_id', company.companyId)
    .neq('role', 'owner')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/company/members — 移除成員（不可移除 owner 列），僅 owner/admin 角色可用
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (company.role !== 'owner' && company.role !== 'admin')
    return NextResponse.json({ error: '僅公司管理者可移除成員' }, { status: 403 })

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_members')
    .delete()
    .eq('id', id)
    .eq('company_id', company.companyId)
    .neq('role', 'owner')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
