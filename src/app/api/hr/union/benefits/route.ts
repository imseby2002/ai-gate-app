import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('hr_union_benefits')
    .select(`
      *,
      hr_union_members (
        full_name, id_number, store, position, union_card_no
      )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ benefits: [] })
  return NextResponse.json({ benefits: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { member_id, benefit_type, amount, request_date, notes, proof_doc_path } = body

  if (!member_id || !benefit_type) {
    return NextResponse.json({ error: 'member_id and benefit_type required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hr_union_benefits')
    .insert({
      owner_id: user.id,
      member_id,
      benefit_type,
      amount: Math.max(0, Number(amount) || 0),
      request_date: request_date || new Date().toISOString().slice(0, 10),
      proof_doc_path: String(proof_doc_path ?? '').trim(),
      notes: String(notes ?? '').trim(),
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ benefit: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, status, approved_by, notes } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (status) {
    patch.status = status
    if (status === 'disbursed') patch.disbursed_at = new Date().toISOString()
  }
  if (approved_by) patch.approved_by = approved_by
  if (notes !== undefined) patch.notes = notes

  const { data, error } = await supabase
    .from('hr_union_benefits')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ benefit: data })
}
