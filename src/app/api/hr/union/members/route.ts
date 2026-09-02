import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const store = sp.get('store')

  let q = supabase
    .from('hr_union_members')
    .select(`
      *,
      hr_employees (
        name, phone, email, store, department, position, hire_date
      )
    `)
    .eq('owner_id', user.id)

  if (store) q = q.eq('store', store)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) {
    // 若資料表尚未建立或為空，回傳空陣列以保證前端穩定
    return NextResponse.json({ members: [] })
  }
  return NextResponse.json({ members: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { employee_id, full_name, id_number, bhxh_number, store, position, join_date, union_card_no, notes } = body

  if (!full_name) return NextResponse.json({ error: 'Họ tên là bắt buộc' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_union_members')
    .insert({
      owner_id: user.id,
      employee_id: employee_id || null,
      full_name: String(full_name).trim(),
      id_number: String(id_number ?? '').trim(),
      bhxh_number: String(bhxh_number ?? '').trim(),
      store: String(store ?? '').trim(),
      position: String(position ?? '').trim(),
      join_date: join_date || new Date().toISOString().slice(0, 10),
      union_card_no: String(union_card_no ?? '').trim(),
      notes: String(notes ?? '').trim(),
      status: 'active',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, ...patch } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  patch.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('hr_union_members')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('hr_union_members').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
