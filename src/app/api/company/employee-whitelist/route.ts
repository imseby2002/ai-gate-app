import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'

async function requireCompanyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, company: null, user: null, admin: null }

  const company = await getUserCompany(user.id)
  if (!company) return { error: '尚未屬於任何公司', status: 400, company: null, user, admin: null }

  // 僅公司擁有者或管理員可新增/修改員工名單
  if (company.role !== 'owner' && company.role !== 'admin') {
    return { error: '僅公司負責人或管理員可維護員工名單', status: 403, company, user, admin: null }
  }

  const admin = createAdminClient()
  return { error: null, status: 200, company, user, admin }
}

// GET - 取得本公司員工名單
export async function GET() {
  const { error, status, company, admin } = await requireCompanyAdmin()
  if (error || !company || !admin) return NextResponse.json({ error }, { status })

  const { data, error: dbError } = await admin
    .from('employee_whitelist')
    .select('id, email, note, company_id, added_at')
    .eq('company_id', company.companyId)
    .order('added_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const list = (data ?? []).map(d => ({
    ...d,
    company: { id: company.companyId, name: company.name },
  }))

  return NextResponse.json({
    company: { id: company.companyId, name: company.name },
    entries: list,
  })
}

// POST - 本公司新增員工（固定所屬公司為本公司）
export async function POST(request: NextRequest) {
  const { error, status, company, user, admin } = await requireCompanyAdmin()
  if (error || !company || !user || !admin) return NextResponse.json({ error }, { status })

  const { email, note } = await request.json().catch(() => ({}))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const cleanEmail = email.toLowerCase().trim()
  const cleanNote = note ? String(note).trim() : null

  const { data, error: dbError } = await admin
    .from('employee_whitelist')
    .insert({
      email: cleanEmail,
      note: cleanNote,
      company_id: company.companyId, // 固定為本公司
      added_by: user.id,
    })
    .select('id, email, note, company_id, added_at')
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: '此 Email 已在員工名單中' }, { status: 409 })
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // 同步綁定已註冊用戶到本公司
  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existingUser) {
    await admin.from('profiles').update({
      user_type: 'employee',
      company_id: company.companyId,
    }).eq('id', existingUser.id)

    await admin.from('company_members').upsert({
      company_id: company.companyId,
      member_id: existingUser.id,
      role: 'viewer',
      status: 'active',
    }, { onConflict: 'company_id,member_id' })
  }

  return NextResponse.json({
    ...data,
    company: { id: company.companyId, name: company.name },
  }, { status: 201 })
}

// PATCH - 更改備註（僅限本公司成員）
export async function PATCH(request: NextRequest) {
  const { error, status, company, admin } = await requireCompanyAdmin()
  if (error || !company || !admin) return NextResponse.json({ error }, { status })

  const { id, note } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const cleanNote = note !== undefined ? (note ? String(note).trim() : null) : undefined

  const { data, error: dbError } = await admin
    .from('employee_whitelist')
    .update({ note: cleanNote })
    .eq('id', id)
    .eq('company_id', company.companyId) // 確保只能修改本公司的
    .select('id, email, note, company_id, added_at')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({
    ...data,
    company: { id: company.companyId, name: company.name },
  })
}

// DELETE - 移除本公司員工
export async function DELETE(request: NextRequest) {
  const { error, status, company, admin } = await requireCompanyAdmin()
  if (error || !company || !admin) return NextResponse.json({ error }, { status })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const { error: dbError } = await admin
    .from('employee_whitelist')
    .delete()
    .eq('id', id)
    .eq('company_id', company.companyId) // 確保只能刪除本公司的

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
