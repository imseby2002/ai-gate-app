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

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const type = searchParams.get('type')

  let query = supabase
    .from('hr_cashflow')
    .select('*')
    .eq('owner_id', user.id)

  if (type) query = query.eq('type', type)
  if (year && month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = Number(month) === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`
    query = query.gte('date', from).lt('date', nextMonth)
  } else if (year) {
    query = query.gte('date', `${year}-01-01`).lt('date', `${Number(year) + 1}-01-01`)
  }

  const { data, error } = await query.order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cashflow: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { type, category, amount, date, description, notes, account_id, to_account_id, receipt_url } = body
  if (!type || !amount || !date) {
    return NextResponse.json({ error: 'type, amount, date required' }, { status: 400 })
  }
  if (type === 'transfer' && (!account_id || !to_account_id || account_id === to_account_id)) {
    return NextResponse.json({ error: '轉帳需指定不同的轉出與轉入帳戶' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hr_cashflow')
    .insert({
      owner_id: user.id, type, category: category ?? '',
      amount: Number(amount), date,
      description: description ?? '', notes: notes ?? '',
      account_id: account_id || null,
      to_account_id: type === 'transfer' ? (to_account_id || null) : null,
      receipt_url: receipt_url ?? '',
    })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cashflow: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_cashflow')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id)
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cashflow: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('hr_cashflow').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
