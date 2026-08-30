// IVT 匯入格式（stock-taking / purchase-order-internal 共用）產生工具。
// 工作表名 "Dữ liệu dùng để import"，欄位：Mã hàng(*), Tên hàng, Mã ĐVT(*), Tên ĐVT, Số lượng(*)
import type { createAdminClient } from '@/lib/supabase/admin'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'
import { computeOrder, loadEffectiveSafety, type CountRow } from '@/lib/inv/reorder'

type Admin = ReturnType<typeof createAdminClient>

export const IVT_SHEET = 'Dữ liệu dùng để import'
export const IVT_HEADER: XlsxCell[] = ['Mã hàng (*)', 'Tên hàng', 'Mã ĐVT (*)', 'Tên ĐVT ', 'Số lượng (*)']
export const ivtRow = (code: string, name: string, unit: string, qty: number): XlsxCell[] => [code, name, unit, '', qty]

const s = (v: unknown) => String(v ?? '').trim()

export type IvtKind = 'ivt-count' | 'ivt-order'

// 某門市最近一張盤點的 id（無則 null）
export async function latestStocktakeId(admin: Admin, ownerId: string, store: string): Promise<string | null> {
  const { data } = await admin.from('inv_stocktakes')
    .select('id').eq('owner_id', ownerId).eq('store', store)
    .order('taken_on', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ?? null
}

// 產生某張盤點的 IVT 匯入檔（實盤 or 訂貨量）。回傳 { buf, filename }；找不到盤點回傳 null。
export async function buildIvtXlsx(admin: Admin, ownerId: string, stocktakeId: string, kind: IvtKind): Promise<{ buf: Buffer; filename: string } | null> {
  const { data: head } = await admin.from('inv_stocktakes')
    .select('store, taken_on').eq('id', stocktakeId).eq('owner_id', ownerId).single()
  if (!head) return null

  const rows: XlsxCell[][] = [IVT_HEADER]
  if (kind === 'ivt-count') {
    const { data: items } = await admin.from('inv_stocktake_items')
      .select('material_code, material_name, unit, counted_qty').eq('stocktake_id', stocktakeId).eq('owner_id', ownerId)
    for (const it of items ?? []) rows.push(ivtRow(s(it.material_code), s(it.material_name), s(it.unit), Number(it.counted_qty) || 0))
    return { buf: buildXlsx(IVT_SHEET, rows), filename: `IVT盤點_${head.store}_${head.taken_on}.xlsx` }
  }

  // ivt-order
  const [{ data: items }, safety] = await Promise.all([
    admin.from('inv_stocktake_items').select('material_code, material_name, unit, counted_qty').eq('stocktake_id', stocktakeId).eq('owner_id', ownerId),
    loadEffectiveSafety(admin, ownerId, head.store, head.taken_on),
  ])
  const order = computeOrder((items ?? []) as CountRow[], safety).filter(o => o.order_qty > 0)
  for (const o of order) rows.push(ivtRow(o.material_code, o.material_name, o.unit, o.order_qty))
  return { buf: buildXlsx(IVT_SHEET, rows), filename: `IVT訂貨_${head.store}_${head.taken_on}.xlsx` }
}
