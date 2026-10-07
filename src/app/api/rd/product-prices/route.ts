import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'

// 產品售價與成本比例（Excel「GIÁ THÀNH ĐỒ UỐNG」白珍珠版 / 「Bảng giá sản phẩm」全加料組合版）
export async function GET() {
  const ctx = await getUnitContextAny(['rd', 'store', 'audit', 'finance'])
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await ctx.admin.from('rd_product_prices')
      .select('id, sheet, sort, group_name, product_name, topping, topping_price, price_s, price_m, price_l, cost_ratio_s, cost_ratio_m, cost_ratio_l, cost_ratio2_s, cost_ratio2_m, cost_ratio2_l')
      .eq('owner_id', ctx.ownerId).order('sheet').order('sort').range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return NextResponse.json({ rows })
}
