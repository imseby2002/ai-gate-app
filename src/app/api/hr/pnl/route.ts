import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// GET /api/hr/pnl?period=YYYY-MM
// 回傳：門市清單、該月所有格值、有資料的月份清單
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const period = req.nextUrl.searchParams.get('period') ?? ''

  const [{ data: stores, error: sErr }, { data: periodsRaw }] = await Promise.all([
    supabase.from('pnl_stores').select('*').eq('owner_id', user.id)
      .eq('archived', false).order('sort', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('pnl_entries').select('period').eq('owner_id', user.id),
  ])
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const periods = Array.from(new Set((periodsRaw ?? []).map(r => r.period))).sort().reverse()

  let entries: { store_id: string; line_code: string; amount: number }[] = []
  if (period) {
    const { data, error } = await supabase.from('pnl_entries')
      .select('store_id, line_code, amount')
      .eq('owner_id', user.id).eq('period', period)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    entries = data ?? []
  }

  return NextResponse.json({ stores: stores ?? [], entries, periods })
}

// PUT /api/hr/pnl  批次 upsert 格值
// body: { period, source?, values: { store_id, line_code, amount }[] }
export async function PUT(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const period: string = body?.period ?? ''
  const source: string = ['manual', 'import', 'cashflow'].includes(body?.source) ? body.source : 'manual'
  const values = Array.isArray(body?.values) ? body.values : []
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'period 格式須為 YYYY-MM' }, { status: 400 })
  if (values.length === 0) return NextResponse.json({ error: '沒有可寫入的資料' }, { status: 400 })
  if (values.length > 5000) return NextResponse.json({ error: '單次最多 5000 格' }, { status: 400 })

  const rows = []
  for (const v of values) {
    const amount = Number(v?.amount)
    if (!v?.store_id || !v?.line_code || !Number.isFinite(amount)) continue
    rows.push({
      owner_id: user.id, store_id: v.store_id, period,
      line_code: v.line_code, amount, source,
      updated_at: new Date().toISOString(),
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: '無有效資料' }, { status: 400 })

  const { error } = await supabase.from('pnl_entries')
    .upsert(rows, { onConflict: 'owner_id,store_id,period,line_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, upserted: rows.length })
}
