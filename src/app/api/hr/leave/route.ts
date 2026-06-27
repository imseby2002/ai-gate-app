import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employee_id = searchParams.get('employee_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('hr_leave_requests')
    .select('*, hr_employees(name, department, position)')
    .eq('owner_id', user.id)

  if (employee_id) query = query.eq('employee_id', employee_id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leaves: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { employee_id, leave_type, start_date, end_date, days, reason, status, notes } = body
  if (!employee_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'employee_id, start_date, end_date required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hr_leave_requests')
    .insert({
      owner_id: user.id, employee_id,
      leave_type: leave_type ?? 'annual',
      start_date, end_date,
      days: days ?? 1,
      reason: reason ?? '',
      status: status ?? 'approved',
      notes: notes ?? '',
    })
    .select('*, hr_employees(name, department, position)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leave: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (updates.status && updates.status !== 'pending' && !updates.reviewed_at) {
    updates.reviewed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('hr_leave_requests')
    .update(updates)
    .eq('id', id).eq('owner_id', user.id)
    .select('*, hr_employees(name, department, position)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leave: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('hr_leave_requests').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
