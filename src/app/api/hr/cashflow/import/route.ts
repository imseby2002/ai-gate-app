import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
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
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
