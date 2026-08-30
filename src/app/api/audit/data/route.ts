import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

// 稽核部門讀取四來源資料（皆歸屬公司 owner）。audit 或 store 單位、管理者可用。
async function ctx() {
  const c = await getUnitContextAny(['audit', 'store'])
  return c.ok ? c : null
}
const s = (v: unknown) => String(v ?? '').trim()
const int = (v: unknown) => { const n = parseInt(String(v ?? '')); return Number.isFinite(n) ? n : 0 }

// ?kind=sales|balance|prices&store=&year=&month=
export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const kind = s(sp.get('kind'))
  const store = s(sp.get('store'))
  const year = int(sp.get('year'))
  const month = int(sp.get('month'))

  if (kind === 'prices') {
    // 中央廚房標準出貨價（無門市/月份維度）
    const { data, error } = await c.admin.from('inv_material_prices')
      .select('material_code, material_name, unit, export_price, purchase_price, updated_at')
      .eq('owner_id', c.ownerId).order('material_code')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rows: data ?? [] })
  }

  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  if (kind === 'sales') {
    // IPOS 產品銷售量
    let q = c.admin.from('inv_pos_sales')
      .select('product_code, product_name, qty, revenue, year, month')
      .eq('owner_id', c.ownerId).eq('store', store)
    if (year) q = q.eq('year', year)
    if (month) q = q.eq('month', month)
    const { data, error } = await q.order('qty', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rows: data ?? [] })
  }

  if (kind === 'balance') {
    // IVT 進銷存（期初/進/出/期末）
    let q = c.admin.from('inv_movements')
      .select('material_code, material_name, unit, open_qty, in_total, out_pos, out_total, close_qty, usage_month, year, month')
      .eq('owner_id', c.ownerId).eq('store', store)
    if (year) q = q.eq('year', year)
    if (month) q = q.eq('month', month)
    const { data, error } = await q.order('material_code')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rows: data ?? [] })
  }

  return NextResponse.json({ error: 'kind 需為 sales | balance | prices' }, { status: 400 })
}
