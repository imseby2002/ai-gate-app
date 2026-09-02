// 外務文件提醒核心：
// 1. 到期三階通知：前 3 個月 (90天) 通知外務、前 1 個月 (30天) 通知外務、前半個月 (15天) 若未更新緊急通知外務＋總經理室。
// 2. 租約繳費雙階通知：前 3 天、前 1 天通知出納。
// 3. 通知管道：Telegram、Email、ZALO 個人 (經由 Zalo OA 推播)。
// 4. 天數可由後台設定更改，亦支援每份文件個別自訂。
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

export interface RoleChannel {
  telegram?: string
  email?: string
  zalo?: string
}

export interface ExtSettings {
  external_telegram: string
  external_email: string
  external_zalo: string
  general_telegram: string
  general_email: string
  general_zalo: string
  cashier_telegram: string
  cashier_email: string
  cashier_zalo: string
  gm_telegram: string
  gm_email: string
  gm_zalo: string
  default_expiry_stage1_days: number
  default_expiry_stage2_days: number
  default_expiry_urgent_days: number
  default_pay_stage1_days: number
  default_pay_stage2_days: number
}

async function sendToRole(ownerId: string, ch: RoleChannel, title: string, body: string) {
  const text = `${title}\n\n${body}`
  // 1. Telegram
  if (ch.telegram) {
    try { await sendToCustomer(ownerId, 'telegram', ch.telegram, text) } catch { /* best-effort */ }
  }
  // 2. Email
  if (ch.email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
        to: [ch.email], subject: title, text: body,
      })
    } catch { /* best-effort */ }
  }
  // 3. ZALO 個人 (透過 Zalo OA 主動推播)
  if (ch.zalo) {
    try {
      await sendToCustomer(ownerId, 'zalo', ch.zalo, text)
    } catch { /* best-effort */ }
  }
}

export const TYPE_LABEL: Record<string, string> = {
  lease: '門市租約',
  sanitary_cert: '門市衛生證',
  company_license: '公司執照',
  patent_cert: '專利證書',
  contract: '廠商合約',
  license: '門市衛生證', // 歷史相容
  other: '其他文書',
}

// 取得擴充通知設定
export async function getAffairSettings(admin: Admin, ownerId: string): Promise<ExtSettings> {
  const [{ data: s1 }, { data: s2 }] = await Promise.all([
    admin.from('affair_settings').select('*').eq('owner_id', ownerId).maybeSingle(),
    admin.from('social_platform_credentials').select('credentials').eq('user_id', ownerId).eq('platform', 'affair_settings').maybeSingle(),
  ])
  const cred = (s2?.credentials as Record<string, unknown>) ?? {}
  return {
    external_telegram: String(s1?.external_telegram || cred.external_telegram || ''),
    external_email: String(s1?.external_email || cred.external_email || ''),
    external_zalo: String(s1?.external_zalo || cred.external_zalo || ''),
    general_telegram: String(s1?.general_telegram || cred.general_telegram || ''),
    general_email: String(s1?.general_email || cred.general_email || ''),
    general_zalo: String(s1?.general_zalo || cred.general_zalo || ''),
    cashier_telegram: String(s1?.cashier_telegram || cred.cashier_telegram || ''),
    cashier_email: String(s1?.cashier_email || cred.cashier_email || ''),
    cashier_zalo: String(s1?.cashier_zalo || cred.cashier_zalo || ''),
    gm_telegram: String(s1?.gm_telegram || cred.gm_telegram || ''),
    gm_email: String(s1?.gm_email || cred.gm_email || ''),
    gm_zalo: String(s1?.gm_zalo || cred.gm_zalo || ''),
    default_expiry_stage1_days: Number(s1?.default_expiry_stage1_days || cred.default_expiry_stage1_days) || 90,
    default_expiry_stage2_days: Number(s1?.default_expiry_stage2_days || cred.default_expiry_stage2_days) || 30,
    default_expiry_urgent_days: Number(s1?.default_expiry_urgent_days || cred.default_expiry_urgent_days) || 15,
    default_pay_stage1_days: Number(s1?.default_pay_stage1_days || cred.default_pay_stage1_days) || 3,
    default_pay_stage2_days: Number(s1?.default_pay_stage2_days || cred.default_pay_stage2_days) || 1,
  }
}

// 執行外務到期與繳費提醒檢查
export async function runAffairReminders(admin: Admin, ownerId?: string): Promise<{ expiry: number; payment: number }> {
  const today = taipeiDate(0)
  let q = admin.from('affair_documents')
    .select('id, owner_id, doc_type, title, store_code, counterparty, expiry_date, payment_day, remind_days_before, pay_remind_days_before, ai_extracted')
    .eq('status', 'active')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data: docs } = await q
  if (!docs || docs.length === 0) return { expiry: 0, payment: 0 }

  const ownerIds = [...new Set(docs.map(d => d.owner_id))]
  const [{ data: stores }, { data: sentLog }] = await Promise.all([
    admin.from('fin_stores').select('owner_id, code, name').in('owner_id', ownerIds),
    admin.from('affair_reminder_log').select('document_id, kind, due_date').in('owner_id', ownerIds),
  ])

  // 快取每位 owner 的完整設定
  const settingsMap = new Map<string, ExtSettings>()
  for (const oid of ownerIds) {
    settingsMap.set(oid, await getAffairSettings(admin, oid))
  }

  const storeName = (owner: string, code: string) =>
    (stores ?? []).find(s => s.owner_id === owner && s.code === code)?.name || code
  const sentKey = new Set((sentLog ?? []).map(r => `${r.document_id}|${r.kind}|${r.due_date}`))

  let expiry = 0, payment = 0
  for (const d of docs) {
    const st = settingsMap.get(d.owner_id)
    if (!st) continue
    const where = d.store_code ? `（${storeName(d.owner_id, d.store_code)}）` : ''
    const label = TYPE_LABEL[d.doc_type] ?? '文件'
    const extra = (d.ai_extracted as Record<string, any>) ?? {}

    // ─────────────────────────────────────────────────────────────
    // 一、到期三階梯提醒（外務／總務／總經理室）
    // ─────────────────────────────────────────────────────────────
    if (d.expiry_date) {
      const du = daysBetween(today, d.expiry_date)
      const isRenewed = Boolean(extra.is_renewed)
      const stage1 = Number(d.remind_days_before) || st.default_expiry_stage1_days || 90
      const stage2 = Number(extra.remind_days_stage2) || st.default_expiry_stage2_days || 30
      const urgent = Number(extra.remind_days_urgent) || st.default_expiry_urgent_days || 15

      // 階段 3：後半個月 (<= urgent 天) 緊急通報（若尚未更新合約）
      const kUrgent = `${d.id}|expiry_urgent|${d.expiry_date}`
      if (du <= urgent && !isRenewed && !sentKey.has(kUrgent)) {
        const title = `🚨【緊急通報】${label}即將到期且尚未更新：${d.title || '（未命名）'}`
        const when = du < 0 ? `已逾期 ${-du} 天` : `僅剩 ${du} 天到期`
        const body = `${label}${where}${d.counterparty ? `・簽約方 ${d.counterparty}` : ''}\n到期日 ${d.expiry_date}（${when}），目前尚未完成更新或續約！\n請外務單位與總經理室立即緊急處理。`

        // 發送給 外務 ＋ 總經理室
        await sendToRole(d.owner_id, { telegram: st.external_telegram, email: st.external_email, zalo: st.external_zalo }, title, body)
        await sendToRole(d.owner_id, { telegram: st.gm_telegram, email: st.gm_email, zalo: st.gm_zalo }, title, body)

        await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_expiry_urgent', title, body })
        await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'expiry_urgent', due_date: d.expiry_date })
        sentKey.add(kUrgent)
        expiry++
      }
      // 階段 2：前 1 個月 (<= stage2 天且 > urgent 天) 追蹤通知
      else if (du <= stage2 && du > urgent) {
        const kS2 = `${d.id}|expiry_s2|${d.expiry_date}`
        if (!sentKey.has(kS2)) {
          const title = `📄 ${label}即將到期追蹤（前 1 個月）：${d.title || '（未命名）'}`
          const body = `${label}${where}${d.counterparty ? `・簽約方 ${d.counterparty}` : ''}\n到期日 ${d.expiry_date}（剩餘 ${du} 天）。請外務單位再次確認續約進度。`

          await sendToRole(d.owner_id, { telegram: st.external_telegram, email: st.external_email, zalo: st.external_zalo }, title, body)
          await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_expiry_s2', title, body })
          await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'expiry_s2', due_date: d.expiry_date })
          sentKey.add(kS2)
          expiry++
        }
      }
      // 階段 1：前 3 個月 (<= stage1 天且 > stage2 天) 首次提醒
      else if (du <= stage1 && du > stage2) {
        const kS1 = `${d.id}|expiry_s1|${d.expiry_date}`
        if (!sentKey.has(kS1)) {
          const title = `📄 ${label}到期提醒（前 3 個月）：${d.title || '（未命名）'}`
          const body = `${label}${where}${d.counterparty ? `・簽約方 ${d.counterparty}` : ''}\n到期日 ${d.expiry_date}（尚有 ${du} 天）。請外務單位洽談續約條件或尋覓新地點。`

          await sendToRole(d.owner_id, { telegram: st.external_telegram, email: st.external_email, zalo: st.external_zalo }, title, body)
          await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_expiry_s1', title, body })
          await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'expiry_s1', due_date: d.expiry_date })
          sentKey.add(kS1)
          expiry++
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 二、門市租約繳款雙階通知（前 3 天、前 1 天通知出納）
    // ─────────────────────────────────────────────────────────────
    if (d.doc_type === 'lease' && d.payment_day) {
      const payStage1 = Number(d.pay_remind_days_before) || st.default_pay_stage1_days || 3
      const payStage2 = Number(extra.pay_remind_days_2) || st.default_pay_stage2_days || 1
      const due = thisMonthPaymentDate(today, d.payment_day)
      const du = daysBetween(today, due)

      // 繳款階段 2：前 1 天通知 (<= payStage2 天且 >= 0 天)
      const kP2 = `${d.id}|payment_s2|${due}`
      if (du <= payStage2 && du >= 0 && !sentKey.has(kP2)) {
        const title = `💰 門市租約繳費即時提醒（${du === 0 ? '今日應繳' : '明日應繳'}）：${d.title || '（未命名）'}`
        const body = `${label}${where}\n繳款日為 ${due}（${du === 0 ? '今天到期' : '明天即將到期'}）。請出納準備並確認租金款項繳納。`

        await sendToRole(d.owner_id, { telegram: st.cashier_telegram, email: st.cashier_email, zalo: st.cashier_zalo }, title, body)
        await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_payment_s2', title, body })
        await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'payment_s2', due_date: due })
        sentKey.add(kP2)
        payment++
      }
      // 繳款階段 1：前 3 天通知 (<= payStage1 天且 > payStage2 天)
      else if (du <= payStage1 && du > payStage2) {
        const kP1 = `${d.id}|payment_s1|${due}`
        if (!sentKey.has(kP1)) {
          const title = `💰 門市租約繳費提前提醒（尚有 ${du} 天）：${d.title || '（未命名）'}`
          const body = `${label}${where}\n繳款日為 ${due}（尚有 ${du} 天）。請出納提前準備安排租金支付。`

          await sendToRole(d.owner_id, { telegram: st.cashier_telegram, email: st.cashier_email, zalo: st.cashier_zalo }, title, body)
          await admin.from('hr_notifications').insert({ owner_id: d.owner_id, kind: 'affair_payment_s1', title, body })
          await admin.from('affair_reminder_log').insert({ owner_id: d.owner_id, document_id: d.id, kind: 'payment_s1', due_date: due })
          sentKey.add(kP1)
          payment++
        }
      }
    }
  }

  return { expiry, payment }
}
