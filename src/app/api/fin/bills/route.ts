import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['finance', 'store'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 月度費用格：門市 × 科目。query: year, month, store_code
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  const storeFilter = sp.get('store_code')?.trim()

  let billQuery = supabase.from('fin_bills')
    .select('store_code, category_code, amount, source, note, updated_at')
    .eq('owner_id', user.id)
    .eq('year', year)
    .eq('month', month)
  if (storeFilter) billQuery = billQuery.eq('store_code', storeFilter)

  const [{ data: stores }, { data: cats }, { data: bills }] = await Promise.all([
    supabase.from('fin_stores').select('code, name, region, electricity_no, water_no').eq('owner_id', user.id).eq('active', true).order('region').order('code'),
    supabase.from('fin_expense_categories').select('code, name, entry_method, vendor_service').eq('owner_id', user.id).order('sort').order('code'),
    billQuery,
  ])
  return NextResponse.json({ year, month, stores: stores ?? [], categories: cats ?? [], bills: bills ?? [] })
}

// 更新單格。body: { store_code, year, month, category_code, amount, source?, note? }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store_code = String(b.store_code ?? '').trim()
  const category_code = String(b.category_code ?? '').trim()
  const year = parseInt(b.year) || 0
  const month = parseInt(b.month) || 0
  if (!store_code || !category_code || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: 'store_code / category_code / year / month 必填' }, { status: 400 })
  }
  const { error } = await supabase.from('fin_bills').upsert({
    owner_id: user.id, store_code, year, month, category_code,
    amount: Number(b.amount) || 0, source: b.source ?? 'manual', note: String(b.note ?? ''),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,store_code,year,month,category_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
