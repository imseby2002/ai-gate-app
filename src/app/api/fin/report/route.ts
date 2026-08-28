import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 每店收支報表：cashflow(日常收支) + fin_bills(月度費用)。query: store(可空=全部), year, month
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = (sp.get('store') ?? '').trim()
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

  let cfQ = supabase.from('hr_cashflow').select('type, category, amount, store_code')
    .eq('owner_id', user.id).gte('date', from).lt('date', to)
  if (store) cfQ = cfQ.eq('store_code', store)
  let bQ = supabase.from('fin_bills').select('store_code, category_code, amount')
    .eq('owner_id', user.id).eq('year', year).eq('month', month)
  if (store) bQ = bQ.eq('store_code', store)
  const [{ data: cf }, { data: bills }, { data: cats }] = await Promise.all([
    cfQ, bQ, supabase.from('fin_expense_categories').select('code, name').eq('owner_id', user.id),
  ])
  const catName: Record<string, string> = {}
  for (const c of cats ?? []) catName[c.code] = c.name

  let income = 0, expenseCash = 0
  const cashByCat: Record<string, number> = {}
  for (const r of cf ?? []) {
    const amt = Number(r.amount) || 0
    if (r.type === 'income') income += amt
    else if (r.type === 'expense') { expenseCash += amt; const k = r.category || '其他'; cashByCat[k] = (cashByCat[k] ?? 0) + amt }
  }

  let billsTotal = 0
  const billByCat: Record<string, number> = {}
  for (const r of bills ?? []) {
    const amt = Number(r.amount) || 0
    billsTotal += amt
    const k = catName[r.category_code] || r.category_code
    billByCat[k] = (billByCat[k] ?? 0) + amt
  }

  const expense = expenseCash + billsTotal
  const expenseRows = [
    ...Object.entries(billByCat).map(([name, amount]) => ({ name, amount, kind: 'bill' })),
    ...Object.entries(cashByCat).map(([name, amount]) => ({ name, amount, kind: 'cash' })),
  ].sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    store, year, month,
    income, expense, net: income - expense,
    expense_cash: expenseCash, bills_total: billsTotal,
    expense_rows: expenseRows,
  })
}
