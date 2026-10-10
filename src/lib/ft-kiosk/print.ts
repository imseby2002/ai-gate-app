import { createAdminClient } from '@/lib/supabase/admin'
import type { ResolvedSelection } from './cart'
import type { FtDineOption, FtPrintLine, FtPrintTicket } from './types'

// 列印模式：不送 iPOS，存一筆本地訂單取得當天流水號，
// 點單機與吧檯各印一張，客人拿單到櫃台由店員在 FABI 結帳。
// 單據上的品名用 iPOS 原文（越南文），店員才能在 FABI 找到同一個品項。

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** 越南時間的營業日（YYYY-MM-DD） */
function bizDate(now: Date) {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

export function toPrintLines(resolved: ResolvedSelection[]): FtPrintLine[] {
  return resolved.map(r => ({
    name: r.item.item_name,
    detail: [r.child?.item_name, ...r.options.map(o => o.item_name), r.note]
      .filter(Boolean)
      .join(' · '),
    qty: r.qty,
    lineTotal: r.lineTotal,
  }))
}

interface PrintOrderInput {
  storeNo: string
  storeName: string
  deviceKey: string
  dineOption: FtDineOption
  phone: string | null
  lines: FtPrintLine[]
  total: number
}

/** 存訂單並取得當天流水號；同時下單撞號時重試 */
export async function createPrintOrder(input: PrintOrderInput): Promise<FtPrintTicket> {
  const admin = createAdminClient()
  const now = new Date()
  const date = bizDate(now)

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await admin
      .from('ft_print_orders')
      .select('seq')
      .eq('store_no', input.storeNo)
      .eq('biz_date', date)
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle()
    const seq = ((last?.seq as number | undefined) ?? 0) + 1

    const { error } = await admin.from('ft_print_orders').insert({
      store_no: input.storeNo,
      biz_date: date,
      seq,
      device_key: input.deviceKey,
      dine_option: input.dineOption,
      phone: input.phone,
      items: input.lines,
      total: input.total,
    })
    if (!error) {
      return {
        orderNo: String(seq).padStart(3, '0'),
        storeName: input.storeName,
        createdAt: now.toISOString(),
        dineOption: input.dineOption,
        phone: input.phone,
        lines: input.lines,
        total: input.total,
      }
    }
    if (error.code !== '23505') throw error
  }
  throw new Error('PRINT_ORDER_SEQ_CONFLICT')
}
