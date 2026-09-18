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

  // 分頁抓取全部交易——PostgREST 預設每次查詢有筆數上限（1000），帳本量大時
  // 不分頁會漏掉後面的交易，導致結餘算錯（只算到前 1000 筆）。
  // 先問總筆數，再平行發出所有分頁請求（原本序列等待每一頁，帳本量大時
  // 累加延遲可達近一分鐘，畫面在此期間只能顯示「期初餘額」造成誤判為算錯）。
  type Flow = { type: string; amount: number; account_id: string | null; to_account_id: string | null }
  const { count: flowCount, error: countError } = await supabase.from('hr_cashflow')
    .select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  const pageStarts: number[] = []
  for (let from = 0; from < (flowCount ?? 0); from += 1000) pageStarts.push(from)

  const pages = await Promise.all(pageStarts.map(from =>
    supabase.from('hr_cashflow')
      .select('type, amount, account_id, to_account_id').eq('owner_id', user.id)
      .range(from, from + 999)
  ))
  const flows: Flow[] = []
  for (const { data: page, error: flowsError } of pages) {
    if (flowsError) {
      console.error('[hr/accounts] hr_cashflow 分頁查詢失敗', { ownerId: user.id, error: flowsError })
      return NextResponse.json({ error: flowsError.message }, { status: 500 })
    }
    flows.push(...(page ?? []))
  }

  // 結餘 = 期初 + 收入(本帳) - 支出(本帳) - 轉出(本帳) + 轉入(目標帳)
  const deltaByAccount = new Map<string, number>()
  const addDelta = (id: string | null, delta: number) => {
    if (!id) return
    deltaByAccount.set(id, (deltaByAccount.get(id) ?? 0) + delta)
  }
  for (const f of flows) {
    const amt = Number(f.amount) || 0
    if (f.type === 'transfer') {
      addDelta(f.account_id, -amt)
      addDelta(f.to_account_id, amt)
    } else if (f.type === 'income') {
      addDelta(f.account_id, amt)
    } else {
      addDelta(f.account_id, -amt) // expense
    }
  }

  const withBalance = (accounts ?? []).map(a => ({
    ...a,
    balance: (Number(a.opening_balance) || 0) + (deltaByAccount.get(a.id) ?? 0),
  }))

  console.log(`[hr/accounts] owner=${user.id} accounts=${(accounts ?? []).length} flows=${flows.length} accountsWithDelta=${deltaByAccount.size}`)
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
