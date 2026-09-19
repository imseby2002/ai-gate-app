import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
}

export async function GET() {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const { data: accounts, error } = await supabase.from('hr_accounts').select('*').eq('owner_id', user.id)
    .order('sort', { ascending: true }).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 結餘 = 期初 + 收入(本帳) - 支出(本帳) - 轉出(本帳) + 轉入(目標帳)
  // 原本把全部交易抓到 Node process 再逐筆加總，帳本量大（如 26,000+ 筆）時
  // 就算平行分頁也要好幾秒到近一分鐘。改用 DB 端的聚合函式
  // fn_hr_account_balances（見 supabase/migrations/20260918_hr_account_balance_rpc.sql），
  // 只回傳「每個帳戶的異動淨額」這種小結果集，資料庫端用索引即時算完。
  const { data: deltas, error: deltasError } = await supabase
    .rpc('fn_hr_account_balances', { p_owner_id: user.id })
  if (deltasError) return NextResponse.json({ error: deltasError.message }, { status: 500 })

  const deltaByAccount = new Map<string, number>()
  for (const d of deltas ?? []) deltaByAccount.set(d.account_id, Number(d.delta) || 0)

  const withBalance = (accounts ?? []).map(a => ({
    ...a,
    balance: (Number(a.opening_balance) || 0) + (deltaByAccount.get(a.id) ?? 0),
  }))

  return NextResponse.json({ accounts: withBalance })
}

export async function POST(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

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
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

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
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

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
