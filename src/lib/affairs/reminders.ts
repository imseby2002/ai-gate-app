// 外務文件提醒核心：到期 → 外務＋總務；租約每月繳費 → 出納。以台灣時區判日期、去重。
// 供 cron（全 owner）與後台「立即檢查」（單一 owner）共用。
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'

type Admin = ReturnType<typeof createAdminClient>

export function taipeiDate(offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 86400_000)
  return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400_000)
}
function thisMonthPaymentDate(today: string, day: number): string {
  const [y, m] = today.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const d = Math.min(Math.max(1, day), last)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

interface RoleChannel { telegram: string; email: string }
async function sendToRole(ownerId: string, ch: RoleChannel, title: string, body: string) {
  const text = `${title}\n\n${body}`
  if (ch.telegram) {
    try { await sendToCustomer(ownerId, 'telegram', ch.telegram, text) } catch { /* best-effort */ }
  }
  if (ch.email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
        to: [ch.email], subject: title, text: body,
      })
    } catch { /* best-effort */ }
  }
}

const TYPE_LABEL: Record<string, string> = { lease: '門市租約', contract: '廠商合約', license: '衛生證／證照', other: '文件' }

// ownerId 給定則只處理該 owner；否則處理全部 active 文件。
export async function runAffairReminders(admin: Admin, ownerId?: string): Promise<{ expiry: number; payment: number }> {
  const today = taipeiDate(0)
  let q = admin.from('affair_documents')
    .select('id, owner_id, doc_type, title, store_code, counterparty, expiry_date, payment_day, remind_days_before, pay_remind_days_before')
    .eq('status', 'active')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data: docs } = await q
  if (!docs || docs.length === 0) return { expiry: 0, payment: 0 }

  const ownerIds = [...new Set(docs.map(d => d.owner_id))]
  const [{ data: settings }, { data: stores }, { data: sentLog }] = await Promise.all([
    admin.from('affair_settings').select('*').in('owner_id', ownerIds),
    admin.from('fin_stores').select('owner_id, code, name').in('owner_id', ownerIds),
    admin.from('affair_reminder_log').select('document_id, kind, due_date').in('owner_id', ownerIds),
  ])
  const setOf = new Map((settings ?? []).map(s => [s.owner_id, s]))
  const storeName = (owner: string, code: string) =>
    (stores ?? []).find(s => s.owner_id === owner && s.code === code)?.name || code
  const sentKey = new Set((sentLog ?? []).map(r => `${r.document_id}|${r.kind}|${r.due_date}`))

  let expiry = 0, payment = 0
  for (const d of docs) {
    const st = setOf.get(d.owner_id)
    const where = d.store_code ? `（${storeName(d.owner_id, d.store_code)}）` : ''
    const label = TYPE_LABEL[d.doc_type] ?? '文件'

    if (d.expiry_date) {
      const remind = d.remind_days_before ?? 30
      const du = daysBetween(today, d.expiry_date)
      const key = `${d.id}|expiry|${d.expiry_date}`
      if (du <= remind && !sentKey.has(key)) {
        const when = du < 0 ? `已過期 ${-du} 天` : `尚有 ${du} 天到期`
        const title = `📄 ${label}到期提醒：${d.title || '（未命名）'}`
        const body = `${label}${where}${d.counterparty ? `・對方 ${d.counterparty}` : ''}\n到期日 ${d.expiry_date}（${when}）。請外務／總務儘速處理續約或更新。`
        if (st) {
          await sendToRole(d.owner_id, { telegram: st.external_telegram, email: st.external_email }, title, body)
          await sendToRole(d.owner_id, { telegram: st.general_telegram, email: st.general_email }, title, body)
        }
        await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_expiry', title, body })
        await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'expiry', due_date: d.expiry_date })
        expiry++
      }
    }

    if (d.doc_type === 'lease' && d.payment_day) {
      const payRemind = d.pay_remind_days_before ?? 5
      const due = thisMonthPaymentDate(today, d.payment_day)
      const du = daysBetween(today, due)
      const key = `${d.id}|payment|${due}`
      if (du >= 0 && du <= payRemind && !sentKey.has(key)) {
        const title = `💰 租約繳費提醒：${d.title || '（未命名）'}`
        const body = `${label}${where}\n繳費日 ${due}（尚有 ${du} 天）。請出納準備繳款。`
        if (st) await sendToRole(d.owner_id, { telegram: st.cashier_telegram, email: st.cashier_email }, title, body)
        await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_payment', title, body })
        await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'payment', due_date: due })
        payment++
      }
    }
  }
  return { expiry, payment }
}
