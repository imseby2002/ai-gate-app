import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: accounts, error }, { data: flows }] = await Promise.all([
    supabase.from('hr_accounts').select('*').eq('owner_id', user.id)
      .order('sort', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('hr_cashflow').select('type, amount, account_id, to_account_id').eq('owner_id', user.id),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 結餘 = 期初 + 收入(本帳) - 支出(本帳) - 轉出(本帳) + 轉入(目標帳)
  const withBalance = (accounts ?? []).map(a => {
    let bal = Number(a.opening_balance) || 0
    for (const f of flows ?? []) {
      const amt = Number(f.amount) || 0
      if (f.account_id === a.id) {
        if (f.type === 'income') bal += amt
        else bal -= amt // expense / transfer-out
      }
      if (f.type === 'transfer' && f.to_account_id === a.id) bal += amt
    }
    return { ...a, balance: bal }
  })

  return NextResponse.json({ accounts: withBalance })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, kind, opening_balance, currency, note, sort } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_accounts')
    .insert({
      owner_id: user.id, name,
      kind: kind ?? 'cash',
      opening_balance: Number(opening_balance) || 0,
      currency: currency ?? 'TWD',
      note: note ?? '', sort: Number(sort) || 0,
    })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id)
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 有交易掛在此帳戶則擋下，避免結餘錯亂
  const { count } = await supabase
    .from('hr_cashflow').select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id).or(`account_id.eq.${id},to_account_id.eq.${id}`)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: '此帳戶仍有交易記錄，無法刪除（可改為封存）' }, { status: 409 })
  }

  const { error } = await supabase
    .from('hr_accounts').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
