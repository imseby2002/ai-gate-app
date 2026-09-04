import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)

// 門市報表：業績（POS）＋支出/進銷存
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const sp = new URL(req.url).searchParams
  const store = (sp.get('store') ?? '').trim()
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  const [{ data: pos }, { data: mov }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name, qty, revenue')
      .eq('owner_id', user.id).eq('store', store).eq('year', year).eq('month', month)
      .order('revenue', { ascending: false }),
    supabase.from('inv_movements').select('material_code, material_name, unit, open_qty, in_total, in_value, out_total, out_value, close_qty, close_value')
      .eq('owner_id', user.id).eq('store', store).eq('year', year).eq('month', month)
      .order('in_value', { ascending: false }),
  ])

  const posRows = pos ?? []
  const movRows = mov ?? []
  return NextResponse.json({
    store, year, month,
    pos: {
      rows: posRows,
      total_revenue: sum(posRows, r => Number(r.revenue) || 0),
      total_qty: sum(posRows, r => Number(r.qty) || 0),
      product_count: posRows.length,
    },
    inventory: {
      rows: movRows,
      purchase_value: sum(movRows, r => Number(r.in_value) || 0),   // 進貨支出
      out_value: sum(movRows, r => Number(r.out_value) || 0),        // 出庫成本
      close_value: sum(movRows, r => Number(r.close_value) || 0),    // 期末庫存價值
      material_count: movRows.length,
    },
  })
}
