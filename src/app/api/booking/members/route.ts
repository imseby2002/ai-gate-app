import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const ROLES = ['admin', 'manager', 'viewer'] as const
type Role = (typeof ROLES)[number]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_MODULES = ['chat', 'marketing', 'cs', 'leads', 'resume']

type SB = Awaited<ReturnType<typeof createClient>>

// 取得此用戶可自用的模組（admin 視為全部）。純協助者不可邀請成員。
async function selfUsable(supabase: SB, userId: string) {
  const { data: p } = await supabase
    .from('profiles').select('user_type, enabled_modules').eq('id', userId).single()
  const isAdmin = p?.user_type === 'admin'
  const enabled: string[] = p?.enabled_modules ?? DEFAULT_MODULES
  return {
    canUse: (scope: string) => isAdmin || enabled.includes(scope),
    canUseAny: isAdmin || enabled.includes('booking') || enabled.includes('cs'),
  }
}

async function profileMap(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return {} as Record<string, { email: string | null; full_name: string | null }>
  const admin = await createAdminClient()
  const { data } = await admin.from('profiles').select('id, email, full_name').in('id', uniq)
  const map: Record<string, { email: string | null; full_name: string | null }> = {}
  for (const p of data ?? []) map[p.id] = { email: p.email, full_name: p.full_name }
  return map
}

// 列出我邀請的成員 + 我被邀請參與的民宿
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 自動接受 email 相符的待處理邀請
  await supabase.rpc('claim_bnb_invitations')

  const [{ data: managing }, { data: memberships }] = await Promise.all([
    supabase.from('bnb_members').select('*').eq('owner_id', user.id).order('created_at', { ascending: true }),
    supabase.from('bnb_members').select('*').eq('member_id', user.id).eq('status', 'active'),
  ])

  const ids = [
    ...(managing ?? []).map((m) => m.member_id).filter(Boolean),
    ...(memberships ?? []).map((m) => m.owner_id),
  ] as string[]
  const profiles = await profileMap(ids)

  return NextResponse.json({
    self: { id: user.id, email: user.email },
    managing: (managing ?? []).map((m) => ({
      ...m,
      token: undefined,
      member: m.member_id ? profiles[m.member_id] ?? null : null,
    })),
    memberships: (memberships ?? []).map((m) => ({
      owner_id: m.owner_id,
      role: m.role,
      owner: profiles[m.owner_id] ?? null,
    })),
  })
}

// 建立 / 更新邀請
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, role = 'manager' } = await req.json()
  const normEmail = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normEmail)) return NextResponse.json({ error: 'Email 格式錯誤' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: '角色錯誤' }, { status: 400 })
  if (normEmail === (user.email ?? '').toLowerCase())
    return NextResponse.json({ error: '不能邀請自己' }, { status: 400 })

  const { data, error } = await supabase
    .from('bnb_members')
    .upsert(
      { owner_id: user.id, invited_email: normEmail, role: role as Role, invited_by: user.id, status: 'pending', member_id: null, accepted_at: null },
      { onConflict: 'owner_id,invited_email' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: { ...data, token: undefined } })
}

// 修改成員角色
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = await req.json()
  if (!id || !ROLES.includes(role)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { data, error } = await supabase
    .from('bnb_members')
    .update({ role })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: { ...data, token: undefined } })
}

// 移除成員 / 撤銷邀請
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await supabase.from('bnb_members').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
