import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 水電人工匯入。body: { year, month, rows: [{store_code, category_code, amount}] }
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
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
