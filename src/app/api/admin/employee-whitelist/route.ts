import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null, user: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()
  if (profile?.user_type !== 'admin') return { error: 'Forbidden', supabase: null, user: null }
  return { error: null, supabase, user }
}

// GET - list all whitelisted emails with company info
export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { data, error: dbError } = await supabase!
    .from('employee_whitelist')
    .select('id, email, note, company_id, added_at, companies(id, name)')
    .order('added_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - add email to whitelist with optional company_id
export async function POST(request: NextRequest) {
  const { error, supabase, user } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { email, note, company_id } = await request.json().catch(() => ({}))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const cleanEmail = email.toLowerCase().trim()
  const cleanCompanyId = company_id ? String(company_id).trim() : null

  const { data, error: dbError } = await supabase!
    .from('employee_whitelist')
    .insert({
      email: cleanEmail,
      note: note ? String(note).trim() : null,
      company_id: cleanCompanyId,
      added_by: user!.id,
    })
    .select('id, email, note, company_id, added_at, companies(id, name)')
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Email already in whitelist' }, { status: 409 })
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // 若該用戶已在系統中註冊，同步綁定所屬公司與身分
  const { data: existingUser } = await supabase!
    .from('profiles')
    .select('id, user_type, company_id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existingUser) {
    const upd: Record<string, unknown> = { user_type: 'employee' }
    if (cleanCompanyId) upd.company_id = cleanCompanyId
    await supabase!.from('profiles').update(upd).eq('id', existingUser.id)

    if (cleanCompanyId) {
      await supabase!.from('company_members').upsert({
        company_id: cleanCompanyId,
        member_id: existingUser.id,
        role: 'viewer',
        status: 'active',
      }, { onConflict: 'company_id,member_id' })
    }
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH - update note or company_id for an entry
export async function PATCH(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id, note, company_id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const upd: Record<string, unknown> = {}
  if (note !== undefined) upd.note = note ? String(note).trim() : null
  if (company_id !== undefined) upd.company_id = company_id ? String(company_id).trim() : null

  if (Object.keys(upd).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase!
    .from('employee_whitelist')
    .update(upd)
    .eq('id', id)
    .select('id, email, note, company_id, added_at, companies(id, name)')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // 若變更了 company_id 且該用戶已在系統中，同步更新
  if (company_id !== undefined && data?.email) {
    const cleanCompanyId = company_id ? String(company_id).trim() : null
    const { data: existingUser } = await supabase!
      .from('profiles')
      .select('id')
      .eq('email', data.email)
      .maybeSingle()

    if (existingUser) {
      await supabase!.from('profiles').update({ company_id: cleanCompanyId }).eq('id', existingUser.id)
      if (cleanCompanyId) {
        await supabase!.from('company_members').upsert({
          company_id: cleanCompanyId,
          member_id: existingUser.id,
          role: 'viewer',
          status: 'active',
        }, { onConflict: 'company_id,member_id' })
      }
    }
  }

  return NextResponse.json(data)
}

// DELETE - remove email from whitelist
export async function DELETE(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const { error: dbError } = await supabase!
    .from('employee_whitelist')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
