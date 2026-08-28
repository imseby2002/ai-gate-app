import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'
import { computeOrder, type CountRow } from '@/lib/inv/reorder'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
function xlsxResponse(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}

// ?kind=template&store= → 空白盤點表；?kind=order&id= → 訂貨表（補到滿倉）
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const kind = s(sp.get('kind'))

  if (kind === 'template') {
    const store = s(sp.get('store'))
    if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
    const { data } = await supabase.from('inv_movements')
      .select('material_code, material_name, unit, close_qty, year, month')
      .eq('owner_id', user.id).eq('store', store)
      .order('year', { ascending: false }).order('month', { ascending: false })
    const seen = new Set<string>()
    const rows: XlsxCell[][] = [['原料碼', '名稱', '單位', '帳面庫存', '實盤數量']]
    for (const m of data ?? []) {
      if (seen.has(m.material_code)) continue
      seen.add(m.material_code)
      rows.push([m.material_code, m.material_name, m.unit, Number(m.close_qty) || 0, ''])
    }
    return xlsxResponse(buildXlsx('盤點表', rows), `盤點表_${store}.xlsx`)
  }

  if (kind === 'order') {
    const id = s(sp.get('id'))
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data: head } = await supabase.from('inv_stocktakes').select('store, taken_on').eq('id', id).eq('owner_id', user.id).single()
    if (!head) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const [{ data: items }, { data: safety }] = await Promise.all([
      supabase.from('inv_stocktake_items').select('material_code, material_name, unit, counted_qty').eq('stocktake_id', id).eq('owner_id', user.id),
      supabase.from('inv_safety_stock').select('material_code, safety_qty, full_qty').eq('owner_id', user.id).eq('store', head.store),
    ])
    const order = computeOrder((items ?? []) as CountRow[], safety ?? []).filter(o => o.order_qty > 0)
    const rows: XlsxCell[][] = [['原料碼', '名稱', '單位', '實盤', '滿倉量', '訂貨量', '緊急']]
    for (const o of order) rows.push([o.material_code, o.material_name, o.unit, o.counted, o.full, o.order_qty, o.urgent ? '緊急' : ''])
    return xlsxResponse(buildXlsx('訂貨表', rows), `訂貨表_${head.store}_${head.taken_on}.xlsx`)
  }

  return NextResponse.json({ error: 'kind required' }, { status: 400 })
}
