import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()
  if (profile?.user_type !== 'admin') return { error: 'Forbidden', supabase: null }
  return { error: null, supabase, user }
}

// GET - list all whitelisted emails
export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { data, error: dbError } = await supabase!
    .from('employee_whitelist')
    .select('id, email, note, added_at')
    .order('added_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - add email to whitelist
export async function POST(request: NextRequest) {
  const { error, supabase, user } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { email, note } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase!
    .from('employee_whitelist')
    .insert({ email: email.toLowerCase().trim(), note: note ?? null, added_by: user!.id })
    .select('id, email, note, added_at')
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Email already in whitelist' }, { status: 409 })
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// DELETE - remove email from whitelist
export async function DELETE(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  const { error: dbError } = await supabase!
    .from('employee_whitelist')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
