import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { data, error } = await supabase
    .from('hr_union_finances')
    .select('*')
    .eq('owner_id', user.id)
    .order('trans_date', { ascending: false })

  if (error) return NextResponse.json({ finances: [], summary: { income: 0, expense: 0, balance: 0 } })

  const list = data ?? []
  let income = 0, expense = 0
  for (const item of list) {
    const val = Number(item.amount) || 0
    if (item.type === 'income') income += val
    else expense += val
  }

  return NextResponse.json({ finances: list, summary: { income, expense, balance: income - expense } })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json().catch(() => ({}))
  const { type, category, amount, trans_date, voucher_no, description } = body

  if (!type || !amount) return NextResponse.json({ error: 'type and amount required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_union_finances')
    .insert({
      owner_id: user.id,
      type: type === 'expense' ? 'expense' : 'income',
      category: String(category || 'other').trim(),
      amount: Math.max(0, Number(amount) || 0),
      trans_date: trans_date || new Date().toISOString().slice(0, 10),
      voucher_no: String(voucher_no || '').trim(),
      description: String(description || '').trim(),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ finance: data })
}
