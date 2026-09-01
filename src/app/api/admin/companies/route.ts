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

// GET /api/admin/companies — 取得所有公司列表及成員概要
export async function GET() {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const [
    { data: companies, error: compErr },
    { data: members, error: memErr },
    { data: profiles, error: profErr },
  ] = await Promise.all([
    admin.from('companies').select('*').order('created_at', { ascending: false }),
    admin.from('company_members').select('*').order('created_at', { ascending: true }),
    admin.from('profiles').select('id, email, full_name'),
  ])

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

  const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // 組織每間公司的成員資料
  const membersByCompany = new Map<string, any[]>()
  for (const m of members ?? []) {
    const list = membersByCompany.get(m.company_id) ?? []
    list.push({
      ...m,
      profile: m.member_id ? profMap.get(m.member_id) ?? null : null,
    })
    membersByCompany.set(m.company_id, list)
  }

  const result = (companies ?? []).map(c => {
    const compMembers = membersByCompany.get(c.id) ?? []
    const ownerMember = compMembers.find(m => m.role === 'owner' && m.status === 'active')
    const creatorProfile = profMap.get(c.created_by) ?? null
    return {
      ...c,
      creator: creatorProfile,
      owner: ownerMember?.profile ?? null,
      memberCount: compMembers.filter(m => m.status === 'active').length,
      pendingCount: compMembers.filter(m => m.status === 'pending').length,
      members: compMembers,
    }
  })

  return NextResponse.json({ companies: result })
}

// POST /api/admin/companies — 管理員建立獨立公司
export async function POST(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const { name, ownerId, enabledModules, bnbOwnerId } = body as {
      name?: string
      ownerId?: string
      enabledModules?: string[]
      bnbOwnerId?: string
    }

    const trimmedName = String(name ?? '').trim()
    if (!trimmedName) {
      return NextResponse.json({ error: '請提供公司名稱' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. 建立公司實體
    const { data: company, error: compErr } = await admin
      .from('companies')
      .insert({
        name: trimmedName,
        created_by: auth.user!.id,
        enabled_modules: enabledModules ?? null,
        bnb_owner_id: bnbOwnerId || null,
      })
      .select('*')
      .single()

    if (compErr || !company) {
      return NextResponse.json({ error: compErr?.message ?? '建立公司失敗' }, { status: 500 })
    }

    // 2. 若有指定負責人 (owner)，直接將其納入公司作為 owner
    if (ownerId) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', ownerId)
        .single()

      if (ownerProfile) {
        // 先清理該用戶先前的 active 關係（保證一人一公司）
        await admin.from('company_members').delete().eq('member_id', ownerId)

        const { error: memErr } = await admin.from('company_members').insert({
          company_id: company.id,
          member_id: ownerProfile.id,
          invited_email: (ownerProfile.email ?? '').toLowerCase(),
          role: 'owner',
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        })

        if (memErr) {
          console.error('[admin/companies] Failed to assign owner:', memErr)
        }
      }
    }

    return NextResponse.json({ ok: true, company })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// PATCH /api/admin/companies — 管理員更新公司資訊
export async function PATCH(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const { id, name, enabledModules, bnbOwnerId, ownerId } = body as {
      id: string
      name?: string
      enabledModules?: string[] | null
      bnbOwnerId?: string | null
      ownerId?: string
    }

    if (!id) {
      return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })
    }

    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (name !== undefined) patch.name = String(name).trim()
    if (enabledModules !== undefined) patch.enabled_modules = enabledModules
    if (bnbOwnerId !== undefined) patch.bnb_owner_id = bnbOwnerId || null

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await admin.from('companies').update(patch).eq('id', id)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 若變更擁有者
    if (ownerId) {
      const { data: ownerProfile } = await admin
        .from('profiles')
        .select('id, email')
        .eq('id', ownerId)
        .single()

      if (ownerProfile) {
        // 先將原 owner 降為 admin
        await admin
          .from('company_members')
          .update({ role: 'admin' })
          .eq('company_id', id)
          .eq('role', 'owner')

        // 移除新 owner 先前的公司成員紀錄
        await admin.from('company_members').delete().eq('member_id', ownerId)

        // 寫入新 owner
        await admin.from('company_members').insert({
          company_id: id,
          member_id: ownerProfile.id,
          invited_email: (ownerProfile.email ?? '').toLowerCase(),
          role: 'owner',
          status: 'active',
          invited_by: auth.user!.id,
          accepted_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/admin/companies — 管理員刪除公司
export async function DELETE(req: NextRequest) {
  const auth = await checkIsAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: '缺少公司 ID' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('companies').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '內部伺服器錯誤' }, { status: 500 })
  }
}
