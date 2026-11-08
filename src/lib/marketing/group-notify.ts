/**
 * 事件觸發的群組通知（訂單確認／行程異動）：依擁有者設定的規則，自動準備文案草稿，
 * 以持有人的 Telegram 傳「群組＋文案＋一鍵帶入」；持有人用個人 LINE／Zalo 帶入後自己按送出。
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyHolderTelegram, type ShareApp } from '@/lib/marketing/share-drafts'

export type GroupNotifyEvent = 'order_confirmed' | 'itinerary_changed'

const HEADER: Record<GroupNotifyEvent, string> = {
  order_confirmed: '✅ 訂單確認',
  itinerary_changed: '⚠️ 行程異動',
}

/** 不拋錯、不阻塞主流程：呼叫端以 void 呼叫 */
export async function fireGroupNotify(ownerId: string, event: GroupNotifyEvent, body: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: rules } = await admin.from('marketing_group_notify_rules')
      .select('app, group_name, holder_id').eq('user_id', ownerId).eq('event', event).eq('enabled', true)
    if (!rules?.length) return
    const text = `${HEADER[event]}\n\n${body.trim()}`.slice(0, 3500)
    for (const r of rules) {
      const { data: draft } = await admin.from('marketing_share_drafts')
        .insert({ user_id: ownerId, app: r.app, group_name: r.group_name, text })
        .select('id, app, group_name, text').single()
      if (!draft) continue
      const ok = await notifyHolderTelegram(ownerId, r.holder_id as string, draft as { id: string; app: ShareApp; group_name: string | null; text: string })
      if (ok) await admin.from('marketing_share_drafts').update({ notified_count: 1 }).eq('id', draft.id)
    }
  } catch { /* 不中斷主流程 */ }
}

type BookingRow = {
  guest_name?: string | null
  platform_booking_id?: string | null
  check_in?: string | null
  check_out?: string | null
  property_id?: string | null
  status?: string | null
}

const CHANGE_FIELDS: { key: keyof BookingRow; label: string }[] = [
  { key: 'check_in', label: '入住日' },
  { key: 'check_out', label: '退房日' },
  { key: 'property_id', label: '房型／行程' },
  { key: 'status', label: '狀態' },
]

/** 訂房明細更新後比對：入住／退房日、房型、狀態有變才觸發行程異動 */
export async function fireItineraryChange(ownerId: string, before: BookingRow | null, after: BookingRow): Promise<void> {
  if (!before) return
  const changed = CHANGE_FIELDS.filter(f => (before[f.key] ?? null) !== (after[f.key] ?? null))
  if (!changed.length) return

  let names: Record<string, string> = {}
  if (changed.some(f => f.key === 'property_id')) {
    const ids = [before.property_id, after.property_id].filter(Boolean) as string[]
    const { data } = await createAdminClient().from('properties').select('id, name').in('id', ids)
    names = Object.fromEntries((data ?? []).map(p => [p.id as string, p.name as string]))
  }
  const show = (k: keyof BookingRow, v: string | null | undefined) => (k === 'property_id' && v ? names[v] ?? v : v ?? '—')
  const lines = [
    `客人：${after.guest_name ?? before.guest_name ?? '—'}`,
    ...(after.platform_booking_id ? [`訂單號碼：${after.platform_booking_id}`] : []),
    ...changed.map(f => `${f.label}：${show(f.key, before[f.key])} → ${show(f.key, after[f.key])}`),
  ]
  await fireGroupNotify(ownerId, 'itinerary_changed', lines.join('\n'))
}
