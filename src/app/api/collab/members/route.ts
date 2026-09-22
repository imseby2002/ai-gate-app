import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { getBookingEntitlements } from '@/lib/booking/entitlements'
import { getBnbContext } from '@/lib/bnb/context'

const MODULES = ['booking', 'cs'] as const
type Scope = (typeof MODULES)[number]
const ROLES = ['admin', 'manager', 'viewer'] as const
type Role = (typeof ROLES)[number]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SB = Awaited<ReturnType<typeof createClient>>
type Admin = Awaited<ReturnType<typeof createAdminClient>>

// 擁有者可邀請協作的模組（enabled_modules 為 null 視為全開；admin 全開）
async function ownerModules(admin: Admin, ownerId: string): Promise<Scope[]> {
  const { data: p } = await admin
    .from('profiles').select('user_type, enabled_modules').eq('id', ownerId).single()
  const isAdmin = p?.user_type === 'admin'
  const enabled: string[] | null = p?.enabled_modules ?? null
  return MODULES.filter((m) => isAdmin || enabled === null || enabled.includes(m))
}

// 解析「目前實際在操作哪個業務」：比照 CS/訂房頁面本身用的 getBnbContext，
// 團隊名單要跟著同一顆 active_bnb_owner cookie 走，不能只認登入者自己。
// canManage：只有 owner 本人或 admin 角色協作者（比照 canSettings）能看/管團隊名單，
// 一般 manager/viewer 協作者不行——避免「隨便一個協作者都能看到全公司團隊清單」。
async function resolveOwnerAndPermission(supabase: SB, userId: string): Promise<{ ownerId: string; canManage: boolean }> {
  const ctx = await getBnbContext(supabase, 'booking')
  if (!ctx || ctx.ownerId === userId) return { ownerId: userId, canManage: true }
  return { ownerId: ctx.ownerId, canManage: ctx.canSettings }
}

// 這個業務帳號若剛好是某家公司掛的訂房/客服帳號，一併列出該公司的 ERP 團隊
// （company_members），純唯讀顯示，方便核對避免跟 bnb_members 重複邀請同一個人。
async function companyTeam(admin: Admin, ownerId: string) {
  const { data: company } = await admin.from('companies').select('id, name').eq('bnb_owner_id', ownerId).maybeSingle()
  if (!company) return null
  const { data: rows } = await admin.from('company_members')
    .select('member_id, invited_email, role, profiles(email, full_name)')
    .eq('company_id', company.id).eq('status', 'active').order('created_at', { ascending: true })
  return {
    companyName: company.name,
    members: (rows ?? []).map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      return { email: profile?.email ?? r.invited_email, full_name: profile?.full_name ?? null, role: r.role }
    }),
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

// 列出目前操作中業務的團隊名單（依 email 聚合各模組，含待接受邀請）+ 我參與協作的對象
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.rpc('claim_bnb_invitations')

  const { ownerId, canManage } = await resolveOwnerAndPermission(supabase, user.id)
  const admin = await createAdminClient()

  const [{ data: managingRaw }, { data: memberships }, modsRaw, companyTeamRaw] = await Promise.all([
    admin.from('bnb_members').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true }),
    supabase.from('bnb_members').select('*').eq('member_id', user.id).eq('status', 'active'),
    ownerModules(admin, ownerId),
    companyTeam(admin, ownerId),
  ])
  const managing = canManage ? managingRaw : []
  const mods = canManage ? modsRaw : []
  const companyTeamResult = canManage ? companyTeamRaw : null

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
    canManage,
    managing: Object.values(byEmail),
    memberships: Object.values(byOwner),
    companyTeam: companyTeamResult,
  })
}

// 邀請 / 更新：一次可給多個模組各自的角色。作用在「目前操作中的業務」，
// 不是永遠作用在自己名下——僅 owner 本人或 admin 角色協作者可執行（見 resolveOwnerAndPermission）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId, canManage } = await resolveOwnerAndPermission(supabase, user.id)
  if (!canManage) return NextResponse.json({ error: '你沒有管理此業務團隊的權限' }, { status: 403 })
  const admin = await createAdminClient()

  const { email, modules } = await req.json() as { email?: string; modules?: Partial<Record<Scope, Role>> }
  const normEmail = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(normEmail)) return NextResponse.json({ error: 'Email 格式錯誤' }, { status: 400 })
  if (normEmail === (user.email ?? '').toLowerCase())
    return NextResponse.json({ error: '不能邀請自己' }, { status: 400 })
  if (!modules || Object.keys(modules).length === 0)
    return NextResponse.json({ error: '請至少選擇一個模組' }, { status: 400 })

  const allowed = await ownerModules(admin, ownerId)

  // CS 協作人數上限：只在邀請 cs 模組、且對象是新人（非既有協作者改角色）時才計入額度
  if (modules.cs) {
    const { count: existingCsCount } = await admin
      .from('bnb_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('scope', 'cs')
      .neq('invited_email', normEmail)
    const { features } = await getCsEntitlements(admin, ownerId)
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
    const { count: existingBookingCount } = await admin
      .from('bnb_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('scope', 'booking')
      .neq('invited_email', normEmail)
    const { features } = await getBookingEntitlements(admin, ownerId)
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
      owner_id: ownerId, invited_email: normEmail, scope, role,
      invited_by: user.id, status: 'pending', member_id: null, accepted_at: null,
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await admin
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

  const { ownerId, canManage } = await resolveOwnerAndPermission(supabase, user.id)
  if (!canManage) return NextResponse.json({ error: '你沒有管理此業務團隊的權限' }, { status: 403 })
  const admin = await createAdminClient()

  const { id, role, canCorrectAi } = await req.json()
  if (!id) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (role !== undefined) {
    if (!ROLES.includes(role)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
    patch.role = role
  }
  if (canCorrectAi !== undefined) patch.can_correct_ai = !!canCorrectAi
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await admin
    .from('bnb_members').update(patch).eq('id', id).eq('owner_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 移除：single id（單模組）或 email（整個人全模組）
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId, canManage } = await resolveOwnerAndPermission(supabase, user.id)
  if (!canManage) return NextResponse.json({ error: '你沒有管理此業務團隊的權限' }, { status: 403 })
  const admin = await createAdminClient()

  const { id, email } = await req.json()
  let q = admin.from('bnb_members').delete().eq('owner_id', ownerId)
  if (id) q = q.eq('id', id)
  else if (email) q = q.eq('invited_email', String(email).trim().toLowerCase())
  else return NextResponse.json({ error: 'id 或 email 必填' }, { status: 400 })

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
