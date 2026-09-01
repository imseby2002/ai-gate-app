import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  return { ok: true, user }
}

const VALID_ROLES = ['owner', 'admin', 'manager', 'viewer'] as const
type Role = typeof VALID_ROLES[number]

// GET /api/admin/companies/[id]/members — 取得該公司成員清單
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: companyId } = await params
  if (!companyId) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

  const admin = createAdminClient()
  const { data: members, error: memErr } = await admin
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  const userIds = (members ?? []).map(m => m.member_id).filter(Boolean)
  let profMap = new Map<string, any>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name, user_type, is_active')
      .in('id', userIds)
    profMap = new Map((profiles ?? []).map(p => [p.id, p]))
  }

  const list = (members ?? []).map(m => ({
    id: m.id,
    companyId: m.company_id,
    memberId: m.member_id,
    email: m.invited_email,
    role: m.role,
    status: m.status,
    createdAt: m.created_at,
    acceptedAt: m.accepted_at,
    profile: m.member_id ? profMap.get(m.member_id) ?? null : null,
  }))

  return NextResponse.json({ members: list })
}

// POST /api/admin/companies/[id]/members — 管理員將用戶直接加入公司或邀請
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: companyId } = await params
  if (!companyId) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

  try {
    const body = await req.json()
    const { userId, email, role = 'viewer' } = body as {
      userId?: string
      email?: string
      role?: Role
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: '角色無效' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 檢查公司是否存在
    const { data: company, error: compErr } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()
    if (compErr || !company) return NextResponse.json({ error: '公司不存在' }, { status: 404 })

    let targetUserId = userId
    let targetEmail = email?.trim().toLowerCase()

    if (targetUserId) {
      const { data: prof } = await admin.from('profiles').select('id, email').eq('id', targetUserId).single()
      if (!prof) return NextResponse.json({ error: '用戶不存在' }, { status: 404 })
      targetEmail = (prof.email ?? '').toLowerCase()
    } else if (targetEmail) {
      // 根據 email 尋找既有用戶
      const { data: prof } = await admin.from('profiles').select('id, email').eq('email', targetEmail).maybeSingle()
      if (prof) {
        targetUserId = prof.id
      }
    } else {
      return NextResponse.json({ error: '請提供用戶 ID 或 Email' }, { status: 400 })
    }

    // 若設定為 owner，先確保舊 owner 角色轉換
    if (role === 'owner') {
      await admin
        .from('company_members')
        .update({ role: 'admin' })
        .eq('company_id', companyId)
        .eq('role', 'owner')
    }

    if (targetUserId) {
      // 既有用戶直接加入為 active 成員（一人一公司：先移除該用戶所有舊的 active 記錄）
      await admin.from('company_members').delete().eq('member_id', targetUserId)

      const { data: newMember, error: insertErr } = await admin
        .from('company_members')
        .insert({
          company_id: companyId,
          member_id: targetUserId,
          invited_email: targetEmail!,
          role,
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

      // 手動確保 profiles.company_id 也已更新（以防 trigger 延遲）
      await admin.from('profiles').update({ company_id: companyId }).eq('id', targetUserId)

      return NextResponse.json({ ok: true, member: newMember })
    } else {
      // 尚未註冊的使用者：建立 pending 邀請
      const { data: newMember, error: inviteErr } = await admin
        .from('company_members')
        .upsert({
          company_id: companyId,
          invited_email: targetEmail!,
          role,
          status: 'pending',
          invited_by: auth.user!.id,
          member_id: null,
          accepted_at: null,
        }, { onConflict: 'company_id,invited_email' })
        .select('*')
        .single()

      if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, member: newMember })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// PATCH /api/admin/companies/[id]/members — 管理員變更成員角色
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: companyId } = await params
  if (!companyId) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

  try {
    const body = await req.json()
    const { memberRowId, role } = body as { memberRowId: string; role: Role }

    if (!memberRowId || !role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: '參數無效' }, { status: 400 })
    }

    const admin = createAdminClient()

    if (role === 'owner') {
      // 若要設為 owner，需先將既有 owner 轉為 admin
      await admin
        .from('company_members')
        .update({ role: 'admin' })
        .eq('company_id', companyId)
        .eq('role', 'owner')
    }

    const { error: updateErr } = await admin
      .from('company_members')
      .update({ role })
      .eq('id', memberRowId)
      .eq('company_id', companyId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/admin/companies/[id]/members — 管理員將成員移出公司
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: companyId } = await params
  if (!companyId) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

  try {
    const body = await req.json()
    const { memberRowId, memberId } = body as { memberRowId?: string; memberId?: string }

    const admin = createAdminClient()

    let query = admin.from('company_members').delete().eq('company_id', companyId)
    if (memberRowId) {
      query = query.eq('id', memberRowId)
    } else if (memberId) {
      query = query.eq('member_id', memberId)
    } else {
      return NextResponse.json({ error: '缺少成員標識' }, { status: 400 })
    }

    const { error: delErr } = await query
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // 若有 memberId，確保 profiles.company_id 被清空
    if (memberId) {
      await admin
        .from('profiles')
        .update({ company_id: null })
        .eq('id', memberId)
        .eq('company_id', companyId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}
