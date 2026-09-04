import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

interface ImportRow {
  type?: string
  category?: string
  amount?: number | string
  date?: string
  description?: string
  notes?: string
  account_id?: string | null
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const records: ImportRow[] = Array.isArray(body?.records) ? body.records : []
  if (records.length === 0) return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  if (records.length > 2000) return NextResponse.json({ error: '單次最多匯入 2000 筆' }, { status: 400 })

  const rows = []
  for (const r of records) {
    const amount = Number(r.amount)
    if (!r.date || !Number.isFinite(amount) || amount === 0) continue
    rows.push({
      owner_id: user.id,
      type: r.type === 'income' ? 'income' : 'expense',
      category: r.category ?? '',
      amount: Math.abs(amount),
      date: r.date,
      description: r.description ?? '',
      notes: r.notes ?? '',
      account_id: r.account_id || null,
      to_account_id: null,
      receipt_url: '',
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: '所有資料列都無效（缺日期或金額）' }, { status: 400 })

  const { error, count } = await supabase
    .from('hr_cashflow').insert(rows, { count: 'exact' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, imported: count ?? rows.length, skipped: records.length - rows.length })
}
