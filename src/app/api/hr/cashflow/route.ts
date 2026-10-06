import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
}

export async function GET(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const type = searchParams.get('type')

  let rangeFrom: string | null = null
  let query = supabase
    .from('hr_cashflow')
    .select('*')
    .eq('owner_id', user.id)

  if (type) query = query.eq('type', type)
  if (year && month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = Number(month) === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`
    query = query.gte('date', from).lt('date', nextMonth)
    rangeFrom = from
  } else if (year) {
    query = query.gte('date', `${year}-01-01`).lt('date', `${Number(year) + 1}-01-01`)
    rangeFrom = `${year}-01-01`
  }

  const limit = searchParams.get('limit') ? Math.min(Number(searchParams.get('limit')) || 5000, 20000) : 5000
  const { data, error } = await query.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 每筆餘額用：各帳戶在查詢區間起日前的結餘，前端再依時間順序逐筆累加
  let openingBalances: Record<string, number> | undefined
  if (rangeFrom && !type) {
    const r = await balancesBefore(supabase, user.id, rangeFrom)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 500 })
    openingBalances = r.balances
  }
  return NextResponse.json({ cashflow: data, openingBalances })
}

// 區間起日前結餘 = 目前結餘（期初 + fn_hr_account_balances）− 起日（含）之後所有異動
async function balancesBefore(
  supabase: Awaited<ReturnType<typeof getAdminUser>>['supabase'],
  ownerId: string,
  from: string,
): Promise<{ balances: Record<string, number> } | { error: string }> {
  const [{ data: accounts, error: aErr }, { data: deltas, error: dErr }] = await Promise.all([
    supabase.from('hr_accounts').select('id, opening_balance').eq('owner_id', ownerId),
    supabase.rpc('fn_hr_account_balances', { p_owner_id: ownerId }),
  ])
  if (aErr || dErr) return { error: (aErr ?? dErr)!.message }

  const bal: Record<string, number> = {}
  for (const a of accounts ?? []) bal[a.id] = Number(a.opening_balance) || 0
  for (const d of deltas ?? []) bal[d.account_id] = (bal[d.account_id] ?? 0) + (Number(d.delta) || 0)

  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data: rows, error } = await supabase
      .from('hr_cashflow')
      .select('type, amount, account_id, to_account_id')
      .eq('owner_id', ownerId)
      .gte('date', from)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) return { error: error.message }
    for (const r of rows ?? []) {
      const amt = Number(r.amount) || 0
      if (r.account_id) bal[r.account_id] = (bal[r.account_id] ?? 0) - (r.type === 'income' ? amt : -amt)
      if (r.type === 'transfer' && r.to_account_id) bal[r.to_account_id] = (bal[r.to_account_id] ?? 0) - amt
    }
    if (!rows || rows.length < PAGE) break
  }
  return { balances: bal }
}

export async function POST(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const body = await req.json()
  const { type, category, amount, date, description, notes, account_id, to_account_id, receipt_url } = body
  if (!type || !amount || !date) {
    return NextResponse.json({ error: 'type, amount, date required' }, { status: 400 })
  }
  if (type === 'transfer' && (!account_id || !to_account_id || account_id === to_account_id)) {
    return NextResponse.json({ error: '轉帳需指定不同的轉出與轉入帳戶' }, { status: 400 })
  }

  // 未帶父科目時依科目主檔補上，讓左側科目樹能正確彙總
  let categoryParent: string = body.category_parent || ''
  if (!categoryParent && category && (type === 'income' || type === 'expense')) {
    const { data: subj } = await supabase
      .from('fin_subjects')
      .select('parent_name')
      .eq('owner_id', user.id)
      .eq('class', type)
      .eq('name', category)
      .limit(1)
      .maybeSingle()
    categoryParent = subj?.parent_name ?? ''
  }

  const { data, error } = await supabase
    .from('hr_cashflow')
    .insert({
      owner_id: user.id, type, category: category ?? '', category_parent: categoryParent,
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
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 編輯時父科目為空則依科目主檔補上，避免覆蓋成空白導致科目樹漏算
  if (updates.category && !updates.category_parent && (updates.type === 'income' || updates.type === 'expense')) {
    const { data: subj } = await supabase
      .from('fin_subjects')
      .select('parent_name')
      .eq('owner_id', user.id)
      .eq('class', updates.type)
      .eq('name', updates.category)
      .limit(1)
      .maybeSingle()
    if (subj?.parent_name) updates.category_parent = subj.parent_name
  }

  const { data, error } = await supabase
    .from('hr_cashflow')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id)
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cashflow: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('hr_cashflow').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
