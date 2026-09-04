import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const STAGES = new Set(['new', 'screening', 'interview_scheduled', 'interviewed', 'offered', 'rejected', 'hired'])
const STAFF_CATS = new Set(['', 'fulltime', 'hourly'])

const FIELDS = [
  'name', 'email', 'phone', 'position', 'source', 'notes', 'score',
  'store', 'staff_category', 'id_number', 'birthday', 'address', 'interview_at', 'stage', 'identity_locked',
  'docs_submitted_complete',
] as const

export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { data, error } = await supabase
    .from('agent_hr_candidates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ candidates: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

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
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

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
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 1. 清理 Storage 檔案（如有上傳的履歷、證件、合同）
  const [{ data: docs }, { data: contracts }] = await Promise.all([
    supabase.from('hr_candidate_documents').select('storage_path').eq('candidate_id', id).eq('owner_id', user.id),
    supabase.from('hr_contracts').select('storage_path').eq('candidate_id', id).eq('owner_id', user.id),
  ])
  const paths = [
    ...(docs ?? []).map(d => d.storage_path).filter(Boolean),
    ...(contracts ?? []).map(c => c.storage_path).filter(Boolean),
  ]
  if (paths.length > 0) {
    await supabase.storage.from('hr-candidate-docs').remove(paths).catch(() => {})
  }

  const { error } = await supabase
    .from('agent_hr_candidates').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

