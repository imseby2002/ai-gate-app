// 原料批次到期提醒核心：依「到期前天數」分級通知，並以 batch.notified_stage 去重升級。
//  stage 1 門市人員＋管理（remind_staff，預設 7 天）
//  stage 2 管理＋稽核（remind_audit，預設 3 天）
//  stage 3 管理＋稽核（remind_mgmt，預設 1 天）
//  stage 4 已過期且未報廢 → 管理＋稽核＋辦公室
// 供 cron（全 owner）與後台「立即檢查」（單一 owner）共用。以台灣時區判日期。
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

interface Channel { telegram: string; email: string }
async function sendTo(ownerId: string, chans: Channel[], title: string, body: string) {
  const text = `${title}\n\n${body}`
  const seenTg = new Set<string>(), seenEmail = new Set<string>()
  for (const ch of chans) {
    if (ch.telegram && !seenTg.has(ch.telegram)) {
      seenTg.add(ch.telegram)
      try { await sendToCustomer(ownerId, 'telegram', ch.telegram, text) } catch { /* best-effort */ }
    }
    if (ch.email && !seenEmail.has(ch.email) && process.env.RESEND_API_KEY) {
      seenEmail.add(ch.email)
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
          to: [ch.email], subject: title, text: body,
        })
      } catch { /* best-effort */ }
    }
  }
}

type Contact = {
  store: string
  foreman_telegram: string; foreman_email: string
  mgmt_telegram: string; mgmt_email: string
  audit_telegram: string; audit_email: string
  office_telegram: string; office_email: string
}
const chan = (tg?: string, em?: string): Channel => ({ telegram: tg ?? '', email: em ?? '' })

// ownerId 給定則只處理該 owner；否則處理全部 active 批次。回傳各階段發送數。
export async function runExpiryReminders(admin: Admin, ownerId?: string): Promise<{ notified: number; by_stage: Record<number, number> }> {
  const today = taipeiDate(0)
  let q = admin.from('inv_material_batches')
    .select('id, owner_id, store, material_code, material_name, unit, qty, expiry_date, remind_staff, remind_audit, remind_mgmt, notified_stage')
    .eq('status', 'active')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data: batches } = await q
  if (!batches || batches.length === 0) return { notified: 0, by_stage: {} }

  const ownerIds = [...new Set(batches.map(b => b.owner_id))]
  const [{ data: settings }, { data: contacts }, { data: storeRows }] = await Promise.all([
    admin.from('inv_settings').select('owner_id, expiry_remind_staff, expiry_remind_audit, expiry_remind_mgmt').in('owner_id', ownerIds),
    admin.from('inv_store_contacts').select('owner_id, store, foreman_telegram, foreman_email, mgmt_telegram, mgmt_email, audit_telegram, audit_email, office_telegram, office_email').in('owner_id', ownerIds),
    admin.from('fin_stores').select('owner_id, code, name').in('owner_id', ownerIds),
  ])
  const setOf = new Map((settings ?? []).map(s => [s.owner_id, s]))
  const contactOf = new Map((contacts ?? []).map(c => [`${c.owner_id}|${c.store}`, c as Contact]))
  const storeName = (owner: string, code: string) => (storeRows ?? []).find(s => s.owner_id === owner && s.code === code)?.name || code

  const by_stage: Record<number, number> = {}
  let notified = 0
  for (const b of batches) {
    const st = setOf.get(b.owner_id)
    const dStaff = b.remind_staff ?? st?.expiry_remind_staff ?? 7
    const dAudit = b.remind_audit ?? st?.expiry_remind_audit ?? 3
    const dMgmt = b.remind_mgmt ?? st?.expiry_remind_mgmt ?? 1
    const du = daysBetween(today, b.expiry_date)

    // 最緊急的「已達到」階段（4 過期 > 3 前mgmt天 > 2 前audit天 > 1 前staff天）
    let stage = 0
    if (du < 0) stage = 4
    else if (du <= dMgmt) stage = 3
    else if (du <= dAudit) stage = 2
    else if (du <= dStaff) stage = 1
    if (stage === 0 || stage <= (b.notified_stage ?? 0)) continue // 未達或已通知過此（含更高）階段

    const c = contactOf.get(`${b.owner_id}|${b.store}`)
    const foreman = chan(c?.foreman_telegram, c?.foreman_email)
    const mgmt = chan(c?.mgmt_telegram, c?.mgmt_email)
    const audit = chan(c?.audit_telegram, c?.audit_email)
    const office = chan(c?.office_telegram, c?.office_email)

    const name = b.material_name || b.material_code
    const where = storeName(b.owner_id, b.store)
    const when = du < 0 ? `已過期 ${-du} 天` : du === 0 ? '今天到期' : `尚有 ${du} 天到期`
    let title: string, body: string, targets: Channel[]
    if (stage === 4) {
      title = `⛔ ${where} 原料已過期未報廢：${name}`
      body = `原料 ${name}（${b.unit}）批次到期日 ${b.expiry_date}，${when}，尚未於「原料耗材資料」報廢。請管理／稽核／辦公室儘速處理報廢並扣庫存。`
      targets = [mgmt, audit, office]
    } else if (stage === 3) {
      title = `🔴 ${where} 原料即將到期（前 ${dMgmt} 天）：${name}`
      body = `原料 ${name}（${b.unit}）到期日 ${b.expiry_date}，${when}。請管理／稽核注意，到期當天需於「原料耗材資料」報廢。`
      targets = [mgmt, audit]
    } else if (stage === 2) {
      title = `🟠 ${where} 原料即將到期（前 ${dAudit} 天）：${name}`
      body = `原料 ${name}（${b.unit}）到期日 ${b.expiry_date}，${when}。請管理／稽核注意用量與去化。`
      targets = [mgmt, audit]
    } else {
      title = `🟡 ${where} 原料即將到期（前 ${dStaff} 天）：${name}`
      body = `原料 ${name}（${b.unit}）到期日 ${b.expiry_date}，${when}。請門市人員優先使用並留意庫存。`
      targets = [foreman, mgmt]
    }

    await sendTo(b.owner_id, targets, title, body)
    await admin.from('hr_notifications').insert({ owner_id: b.owner_id, kind: 'inv_expiry', title, body })
    await admin.from('inv_material_batches').update({ notified_stage: stage, updated_at: new Date().toISOString() }).eq('id', b.id).eq('owner_id', b.owner_id)
    by_stage[stage] = (by_stage[stage] ?? 0) + 1
    notified++
  }
  return { notified, by_stage }
}
