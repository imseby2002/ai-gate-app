import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const book = req.nextUrl.searchParams.get('book') || 'FT'

  const { data, error } = await supabase
    .from('fin_subjects')
    .select('*')
    .eq('owner_id', user.id)
    .eq('account_book', book)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subjects: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const {
    id,
    account_book = 'FT',
    class: subClass,
    parent_name = '',
    name,
    initial_balance = 0,
    sort_order = 0,
    style = '常態性',
    zero_view = true,
    is_account = false,
  } = body

  if (!name || !subClass) {
    return NextResponse.json({ error: '科目名稱與類別為必填' }, { status: 400 })
  }

  const payload = {
    owner_id: user.id,
    account_book,
    class: subClass,
    parent_name: parent_name.trim(),
    name: name.trim(),
    initial_balance: Number(initial_balance) || 0,
    sort_order: Number(sort_order) || 0,
    style,
    zero_view: zero_view !== false,
    is_account: is_account || subClass === 'asset' || subClass === 'liability',
    updated_at: new Date().toISOString(),
  }

  if (id) {
    const { data, error } = await supabase
      .from('fin_subjects')
      .update(payload)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ subject: data })
  }

  const { data, error } = await supabase
    .from('fin_subjects')
    .upsert(payload, { onConflict: 'owner_id,account_book,class,parent_name,name' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subject: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('fin_subjects')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
