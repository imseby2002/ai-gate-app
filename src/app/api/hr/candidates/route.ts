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

const STAGES = new Set(['new', 'screening', 'interview_scheduled', 'interviewed', 'offered', 'rejected', 'hired'])
const STAFF_CATS = new Set(['', 'fulltime', 'hourly'])

const FIELDS = [
  'name', 'email', 'phone', 'position', 'source', 'notes', 'score',
  'store', 'staff_category', 'id_number', 'birthday', 'address', 'interview_at', 'stage',
] as const

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('agent_hr_candidates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidates: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const stage = STAGES.has(body.stage) ? body.stage : 'new'
  const staff_category = STAFF_CATS.has(body.staff_category) ? body.staff_category : ''

  const { data, error } = await supabase
    .from('agent_hr_candidates')
    .insert({
      user_id: user.id,
      name,
      email: body.email ?? '',
      phone: body.phone ?? '',
      position: body.position ?? '',
      source: body.source ?? '',
      notes: body.notes ?? '',
      score: body.score ?? null,
      store: body.store ?? '',
      staff_category,
      id_number: body.id_number ?? '',
      birthday: body.birthday || null,
      address: body.address ?? '',
      interview_at: body.interview_at || null,
      stage,
    })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidate: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (body.stage !== undefined && !STAGES.has(body.stage)) {
    return NextResponse.json({ error: 'invalid stage' }, { status: 400 })
  }
  if (body.staff_category !== undefined && !STAFF_CATS.has(body.staff_category)) {
    return NextResponse.json({ error: 'invalid staff_category' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      updates[f] = (f === 'birthday' || f === 'interview_at') ? (body[f] || null) : body[f]
    }
  }

  const { data, error } = await supabase
    .from('agent_hr_candidates')
    .update(updates)
    .eq('id', id).eq('user_id', user.id)
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidate: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('agent_hr_candidates').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
