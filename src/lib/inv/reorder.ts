// 門市盤點・訂貨核心：
//  每日訂貨＝補到滿倉（order = full − counted，>0 才訂）。
//  安全量＝緊急線：實盤 ≤ 安全量 → urgent，通知領班人工緊急叫貨／調貨。
import { Resend } from 'resend'
import type { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'

type Admin = ReturnType<typeof createAdminClient>

export interface SafetyRow { material_code: string; safety_qty: number; full_qty: number }
export interface CountRow { material_code: string; material_name: string; unit: string; counted_qty: number }
export interface OrderRow {
  material_code: string; material_name: string; unit: string
  counted: number; safety: number; full: number; order_qty: number; urgent: boolean
}

export function computeOrder(counts: CountRow[], safety: SafetyRow[]): OrderRow[] {
  const safeOf = new Map(safety.map(s => [s.material_code, s]))
  return counts.map(c => {
    const s = safeOf.get(c.material_code)
    const safetyQty = Number(s?.safety_qty) || 0
    const fullQty = Number(s?.full_qty) || 0
    const counted = Number(c.counted_qty) || 0
    const order_qty = Math.max(0, fullQty - counted)  // 一律補到滿倉
    const urgent = fullQty > 0 && safetyQty > 0 && counted <= safetyQty // 低於安全量＝緊急
    return { material_code: c.material_code, material_name: c.material_name, unit: c.unit, counted, safety: safetyQty, full: fullQty, order_qty, urgent }
  })
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('zh-TW')

// 緊急（低於安全量）→ 通知該門市領班（Telegram／Email）＋站內留存。
export async function notifyForeman(admin: Admin, ownerId: string, store: string, storeName: string, urgent: OrderRow[]): Promise<boolean> {
  if (urgent.length === 0) return false
  const { data: contact } = await admin.from('inv_store_contacts')
    .select('foreman_telegram, foreman_email').eq('owner_id', ownerId).eq('store', store).single()

  const list = urgent.slice(0, 20).map(u => `・${u.material_name || u.material_code}：實盤 ${fmt(u.counted)} ≤ 安全 ${fmt(u.safety)}（需補到 ${fmt(u.full)}）`).join('\n')
  const title = `🚨 ${storeName} 低於安全量，需緊急叫貨／調貨`
  const body = `${urgent.length} 項原料已低於安全量：\n${list}${urgent.length > 20 ? '\n…' : ''}\n\n請領班安排緊急叫貨或就近調貨。`

  await admin.from('hr_notifications').insert({ owner_id: ownerId, kind: 'inv_urgent', title, body })

  const text = `${title}\n\n${body}`
  if (contact?.foreman_telegram) {
    try { await sendToCustomer(ownerId, 'telegram', contact.foreman_telegram, text) } catch { /* best-effort */ }
  }
  if (contact?.foreman_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
        to: [contact.foreman_email], subject: title, text: body,
      })
    } catch { /* best-effort */ }
  }
  return true
}
