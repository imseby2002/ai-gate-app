import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  return profile?.user_type === 'admin' ? user : null
}

export async function GET() {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createAdminClient()
  const { data, error } = await supabase.from('agent_roles').select('*').order('sort')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ roles: data })
}

export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { roleId, status } = await req.json()
  if (!roleId || !['active', 'disabled'].includes(status)) {
    return NextResponse.json({ error: 'roleId, status(active|disabled) required' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { error } = await supabase.from('agent_roles').update({ status }).eq('id', roleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
