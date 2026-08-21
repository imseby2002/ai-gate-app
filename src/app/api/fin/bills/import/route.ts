import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 水電人工匯入。body: { year, month, rows: [{store_code, category_code, amount}] }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const year = parseInt(b.year) || 0
  const month = parseInt(b.month) || 0
  const rows = Array.isArray(b.rows) ? b.rows : []
  if (!year || month < 1 || month > 12) return NextResponse.json({ error: '缺少年/月' }, { status: 400 })

  const recs = rows.map((r: Record<string, unknown>) => ({
    owner_id: user.id,
    store_code: String(r.store_code ?? '').trim(),
    year, month,
    category_code: String(r.category_code ?? '').trim(),
    amount: Number(r.amount) || 0,
    source: 'import',
    updated_at: new Date().toISOString(),
  })).filter((r: { store_code: string; category_code: string }) => r.store_code && r.category_code)

  if (recs.length === 0) return NextResponse.json({ error: '沒有可匯入的資料（需 門市編碼、科目編碼、金額）' }, { status: 400 })

  const { error } = await supabase.from('fin_bills')
    .upsert(recs, { onConflict: 'owner_id,store_code,year,month,category_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: recs.length })
}
