/**
 * 預約簡訊提醒：店家開啟後，於預約開始前 N 小時發簡訊給客人。
 * 每筆預約只發一次（reserve_sms_reminders.appointment_id unique），簡訊費用依實際成功發送扣店家點數。
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeUsage, precheckUsage, smsCost } from '@/lib/marketing/billing'
import { sendSmsMessage } from '@/lib/telephony/sms-service'
import { renderReminder } from '@/lib/reserve/sms-template'
import { getReserveEntitlements } from '@/lib/reserve/entitlements'

type StoreRow = { id: string; user_id: string; slug: string; name: string; sms_reminder_hours: number; sms_reminder_template: string | null }
type ApptRow = { id: string; customer_name: string; customer_phone: string; start_time: string; created_at: string; service: { name?: string } | null }

export async function runReserveSmsReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
  const admin = createAdminClient()
  const out = { sent: 0, failed: 0, skipped: 0 }
  const { data: stores } = await admin.from('reserve_stores')
    .select('id, user_id, slug, name, sms_reminder_hours, sms_reminder_template')
    .eq('is_active', true).eq('sms_reminder_enabled', true).limit(500)

  const customTemplate = new Map<string, boolean>()
  for (const store of (stores ?? []) as StoreRow[]) {
    if (!customTemplate.has(store.user_id)) {
      customTemplate.set(store.user_id, (await getReserveEntitlements(store.user_id)).features.customSmsTemplate)
    }
    // 自訂簡訊內容限 CORE，FREE 用預設內容
    const template = customTemplate.get(store.user_id) ? store.sms_reminder_template : null
    const hours = Math.min(Math.max(Number(store.sms_reminder_hours) || 24, 1), 72)
    const now = Date.now()
    const { data: appts } = await admin.from('reserve_appointments')
      .select('id, customer_name, customer_phone, start_time, created_at, service:reserve_services(name)')
      .eq('store_id', store.id).in('status', ['pending', 'confirmed'])
      .gt('start_time', new Date(now).toISOString())
      .lte('start_time', new Date(now + hours * 3600_000).toISOString())
      .order('start_time').limit(200)
    const list = (appts ?? []) as unknown as ApptRow[]
    if (!list.length) continue

    const { data: done } = await admin.from('reserve_sms_reminders').select('appointment_id').in('appointment_id', list.map(a => a.id))
    const doneSet = new Set((done ?? []).map(d => d.appointment_id as string))

    for (const appt of list) {
      if (doneSet.has(appt.id)) continue
      const phone = (appt.customer_phone ?? '').trim()
      // 預約後 30 分鐘內就開始的不再提醒（客人剛預約完）
      const justBooked = now - new Date(appt.created_at).getTime() < 30 * 60_000
      if (phone.replace(/\D/g, '').length < 8 || justBooked) {
        await admin.from('reserve_sms_reminders').insert({ appointment_id: appt.id, store_id: store.id, phone, status: 'skipped', error: justBooked ? 'just_booked' : 'invalid_phone' })
        out.skipped++
        continue
      }
      const text = renderReminder(template, store, appt)
      const cost = smsCost(phone, text)
      if (await precheckUsage(store.user_id, cost)) {
        await admin.from('reserve_sms_reminders').insert({ appointment_id: appt.id, store_id: store.id, phone, status: 'skipped', error: 'insufficient_credits' })
        out.skipped++
        continue
      }
      // 先佔位，避免同時執行的排程重複發送
      const { error: claimErr } = await admin.from('reserve_sms_reminders').insert({ appointment_id: appt.id, store_id: store.id, phone, status: 'sending' })
      if (claimErr) continue
      const res = await sendSmsMessage({ phone, text, name: appt.customer_name }).catch(e => ({ ok: false, provider: undefined, error: String(e?.message ?? e) }))
      if (res.ok) {
        await chargeUsage(store.user_id, cost, `[reserve] 預約簡訊提醒 ${store.name}`)
        out.sent++
      } else out.failed++
      await admin.from('reserve_sms_reminders').update({
        status: res.ok ? 'sent' : 'failed', provider: res.provider ?? null, error: res.ok ? null : (res.error ?? 'send_failed'), cost_usd: res.ok ? cost : 0,
      }).eq('appointment_id', appt.id)
    }
  }
  return out
}
