import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

const MODULES = ['booking', 'cs'] as const
type Scope = (typeof MODULES)[number]
const ROLES = ['admin', 'manager', 'viewer'] as const
type Role = (typeof ROLES)[number]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SB = Awaited<ReturnType<typeof createClient>>

// 擁有者可邀請協作的模組（enabled_modules 為 null 視為全開；admin 全開）
async function ownerModules(supabase: SB, userId: string): Promise<Scope[]> {
  const { data: p } = await supabase
    .from('profiles').select('user_type, enabled_modules').eq('id', userId).single()
  const isAdmin = p?.user_type === 'admin'
  const enabled: string[] | null = p?.enabled_modules ?? null
  return MODULES.filter((m) => isAdmin || enabled === null || enabled.includes(m))
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

// 列出我邀請的協作者（依 email 聚合各模組）+ 我參與協作的對象
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.rpc('claim_bnb_invitations')

  const [{ data: managing }, { data: memberships }, mods] = await Promise.all([
    supabase.from('bnb_members').select('*').eq('owner_id', user.id).order('created_at', { ascending: true }),
    supabase.from('bnb_members').select('*').eq('member_id', user.id).eq('status', 'active'),
    ownerModules(supabase, user.id),
  ])

  const ids = [
    ...(managing ?? []).map((m) => m.member_id).filter(Boolean),
    ...(memberships ?? []).map((m) => m.owner_id),
  ] as string[]
  const profiles = await profileMap(ids)

  // 依 email 聚合：每人一列，列出 booking / cs 各自的角色與狀態
  const byEmail: Record<string, {
    email: string
    member: { email: string | null; full_name: string | null } | null
    scopes: Partial<Record<Scope, { id: string; role: Role; status: string; canCorrectAi: boolean }>>
  }> = {}
  for (const m of managing ?? []) {
    const key = m.invited_email
    if (!byEmail[key]) byEmail[key] = { email: key, member: m.member_id ? profiles[m.member_id] ?? null : null, scopes: {} }
    if (m.member_id && !byEmail[key].member) byEmail[key].member = profiles[m.member_id] ?? null
    byEmail[key].scopes[m.scope as Scope] = { id: m.id, role: m.role as Role, status: m.status, canCorrectAi: !!m.can_correct_ai }
  }

  // 我參與協作的對象，依 owner 聚合
  const byOwner: Record<string, { owner_id: string; owner: { email: string | null; full_name: string | null } | null; scopes: Partial<Record<Scope, Role>> }> = {}
  for (const m of memberships ?? []) {
    if (!byOwner[m.owner_id]) byOwner[m.owner_id] = { owner_id: m.owner_id, owner: profiles[m.owner_id] ?? null, scopes: {} }
    byOwner[m.owner_id].scopes[m.scope as Scope] = m.role as Role
  }

  return NextResponse.json({
    self: { id: user.id, email: user.email },
    ownerModules: mods,
    managing: Object.values(byEmail),
    memberships: Object.values(byOwner),
  })
}

// 邀請 / 更新：一次可給多個模組各自的角色
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, modules } = await req.json() as { email?: string; modules?: Partial<Record<Scope, Role>> }
  const normEmail = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normEmail)) return NextResponse.json({ error: 'Email 格式錯誤' }, { status: 400 })
  if (normEmail === (user.email ?? '').toLowerCase())
    return NextResponse.json({ error: '不能邀請自己' }, { status: 400 })
  if (!modules || Object.keys(modules).length === 0)
    return NextResponse.json({ error: '請至少選擇一個模組' }, { status: 400 })

  const allowed = await ownerModules(supabase, user.id)

  // CS 協作人數上限：只在邀請 cs 模組、且對象是新人（非既有協作者改角色）時才計入額度
  if (modules.cs) {
    const { count: existingCsCount } = await supabase
      .from('bnb_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('scope', 'cs')
      .neq('invited_email', normEmail)
    const { features } = await getCsEntitlements(supabase, user.id)
    if (Number.isFinite(features.collaboratorLimit) && (existingCsCount ?? 0) >= features.collaboratorLimit) {
      return NextResponse.json(
        {
          error: features.collaboratorLimit === 0
            ? '目前方案不支援邀請客服協作者，請升級方案。'
            : `目前方案最多可邀請 ${features.collaboratorLimit} 位客服協作者，請升級方案或先移除其他協作者。`,
        },
        { status: 403 },
      )
    }
  }

  // 訂房協作人數上限：只在邀請 booking 模組、且對象是新人時才計入額度
  if (modules.booking) {
    const { count: existingBookingCount } = await supabase
      .from('bnb_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('scope', 'booking')
      .neq('invited_email', normEmail)
    const { features } = await getBookingEntitlements(supabase, user.id)
    if (Number.isFinite(features.collaboratorLimit) && (existingBookingCount ?? 0) >= features.collaboratorLimit) {
      return NextResponse.json(
        {
          error: features.collaboratorLimit === 0
            ? '目前方案不支援邀請訂房協作者，請升級方案。'
            : `目前方案最多可邀請 ${features.collaboratorLimit} 位訂房協作者，請升級方案或先移除其他協作者。`,
        },
        { status: 403 },
      )
    }
  }

  const rows = [] as Array<Record<string, unknown>>
  for (const [scope, role] of Object.entries(modules)) {
    if (!MODULES.includes(scope as Scope)) continue
    if (!role || !ROLES.includes(role as Role)) continue
    if (!allowed.includes(scope as Scope))
      return NextResponse.json({ error: `你未開通「${scope}」模組，無法邀請該模組協作` }, { status: 403 })
    rows.push({
      owner_id: user.id, invited_email: normEmail, scope, role,
      invited_by: user.id, status: 'pending', member_id: null, accepted_at: null,
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await supabase
    .from('bnb_members')
    .upsert(rows, { onConflict: 'owner_id,invited_email,scope' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 修改單一模組角色，或（cs 模組）是否授權可直接修正 AI 回答
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role, canCorrectAi } = await req.json()
  if (!id) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (role !== undefined) {
    if (!ROLES.includes(role)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
    patch.role = role
  }
  if (canCorrectAi !== undefined) patch.can_correct_ai = !!canCorrectAi
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await supabase
    .from('bnb_members').update(patch).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 移除：single id（單模組）或 email（整個人全模組）
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, email } = await req.json()
  let q = supabase.from('bnb_members').delete().eq('owner_id', user.id)
  if (id) q = q.eq('id', id)
  else if (email) q = q.eq('invited_email', String(email).trim().toLowerCase())
  else return NextResponse.json({ error: 'id 或 email 必填' }, { status: 400 })

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
