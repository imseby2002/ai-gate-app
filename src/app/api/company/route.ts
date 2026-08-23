import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany, isCompanyOwnerOrAdmin } from '@/lib/company/membership'

// GET /api/company — 目前登入者所屬的公司（無則回傳 company: null）
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  return NextResponse.json({ company })
}

// POST /api/company — 建立公司（僅限尚未屬於任何公司的使用者），建立者自動成為 owner
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getUserCompany(user.id)
  if (existing) return NextResponse.json({ error: '您已經屬於一間公司，無法重複建立' }, { status: 400 })

  const { name } = await req.json() as { name?: string }
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: '請輸入公司名稱' }, { status: 400 })

  const admin = createAdminClient()
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .insert({ name: trimmed, created_by: user.id })
    .select('id, name')
    .single()
  if (companyErr || !company) return NextResponse.json({ error: companyErr?.message ?? '建立失敗' }, { status: 500 })

  const { error: memberErr } = await admin.from('company_members').insert({
    company_id: company.id,
    member_id: user.id,
    invited_email: (user.email ?? '').toLowerCase(),
    role: 'owner',
    status: 'active',
    invited_by: user.id,
    accepted_at: new Date().toISOString(),
  })
  if (memberErr) {
    // 擁有者列建立失敗就整間公司一起清掉，避免留下沒有任何成員的孤兒公司
    await admin.from('companies').delete().eq('id', company.id)
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  return NextResponse.json({ company })
}

// PATCH /api/company — 更新公司設定（名稱／開通模組），僅 owner/admin 角色可改
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (!(await isCompanyOwnerOrAdmin(user.id)))
    return NextResponse.json({ error: '僅公司管理者可修改設定' }, { status: 403 })

  const { name, enabledModules } = await req.json() as { name?: string; enabledModules?: string[] | null }
  const patch: Record<string, unknown> = {}
  if (name !== undefined) {
    const trimmed = String(name).trim()
    if (!trimmed) return NextResponse.json({ error: '公司名稱不可為空' }, { status: 400 })
    patch.name = trimmed
  }
  if (enabledModules !== undefined) patch.enabled_modules = enabledModules

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('companies').update(patch).eq('id', company.companyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
