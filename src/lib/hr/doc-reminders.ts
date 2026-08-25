// 人員缺件週提醒：
//  未上傳文件 → 通知個人；正本紙本未勾（人事未收） → 通知個人＋人事。
//  每週一次（依 doc_reminder_at 節流），直到齊全才停。
import type { createAdminClient } from '@/lib/supabase/admin'
import { DOC_CATALOG } from '@/lib/hr/apply'
import { notifyApplicant, notifyHR } from '@/lib/hr/notify'

type Admin = ReturnType<typeof createAdminClient>

const CORE = DOC_CATALOG.filter(d => d.type !== 'other')
const EDU = ['diploma', 'student_card']                              // 學歷／學生證：擇一即可
const UPLOAD_REQ = CORE.filter(d => !EDU.includes(d.type))           // 需上傳（學歷組另計）
const PAPER_REQ = CORE.filter(d => d.copy === 'original' || d.copy === 'both') // 需繳正本紙本
const LABEL = Object.fromEntries(DOC_CATALOG.map(d => [d.type, d.label]))
const WEEK_MS = 7 * 86400_000

interface Person {
  id: string; user_id: string; name: string; email: string | null
  notify_channel: string | null; zalo_user_id: string | null; stage: string; doc_reminder_at: string | null
}

export async function runDocReminders(admin: Admin, ownerId?: string): Promise<{ notified: number; hr_pending: number }> {
  let q = admin.from('agent_hr_candidates')
    .select('id, user_id, name, email, notify_channel, zalo_user_id, stage, doc_reminder_at')
    .neq('stage', 'rejected')
  if (ownerId) q = q.eq('user_id', ownerId)
  const { data: people } = await q
  if (!people || people.length === 0) return { notified: 0, hr_pending: 0 }

  const ids = people.map(p => p.id)
  const [{ data: docs }, { data: checklist }] = await Promise.all([
    admin.from('hr_candidate_documents').select('candidate_id, doc_type').in('candidate_id', ids),
    admin.from('hr_candidate_checklist').select('candidate_id, doc_key, original_received').in('candidate_id', ids),
  ])
  const haveBy = new Map<string, Set<string>>()
  for (const d of docs ?? []) (haveBy.get(d.candidate_id) ?? haveBy.set(d.candidate_id, new Set()).get(d.candidate_id)!).add(d.doc_type)
  const paperBy = new Map<string, Set<string>>() // 已收正本的 doc_key
  for (const c of checklist ?? []) if (c.original_received) (paperBy.get(c.candidate_id) ?? paperBy.set(c.candidate_id, new Set()).get(c.candidate_id)!).add(c.doc_key)

  const now = Date.now()
  const hrPending: string[] = []
  let notified = 0

  for (const p of people as Person[]) {
    const have = haveBy.get(p.id) ?? new Set<string>()
    const paper = paperBy.get(p.id) ?? new Set<string>()
    const missingUpload = UPLOAD_REQ.filter(d => !have.has(d.type)).map(d => d.label)
    if (!have.has('diploma') && !have.has('student_card')) missingUpload.push('學歷／學生證')
    const missingPaper = PAPER_REQ.filter(d => !paper.has(d.type)).map(d => d.label)
    if (missingUpload.length === 0 && missingPaper.length === 0) continue

    if (missingPaper.length > 0) hrPending.push(`${p.name || '（未命名）'}：${missingPaper.join('、')}`)

    // 個人週提醒節流
    const last = p.doc_reminder_at ? new Date(p.doc_reminder_at).getTime() : 0
    if (now - last < WEEK_MS) continue

    const parts: string[] = []
    if (missingUpload.length > 0) parts.push(`尚未上傳：${missingUpload.join('、')}`)
    if (missingPaper.length > 0) parts.push(`尚未繳交正本紙本給人事：${missingPaper.join('、')}`)
    const msg = `${p.name || ''} 您好，您的人事文件尚未齊全：\n${parts.join('\n')}\n\n請儘速完成，以免影響勞動／保險／所得稅檔案建立。`
    const r = await notifyApplicant(p.user_id, { email: p.email, notify_channel: p.notify_channel, zalo_user_id: p.zalo_user_id, name: p.name }, '人事文件補件提醒', msg)
    if (r.ok) {
      await admin.from('agent_hr_candidates').update({ doc_reminder_at: new Date().toISOString() }).eq('id', p.id)
      notified++
    }
  }

  // 人事彙總（紙本未收）
  if (hrPending.length > 0) {
    await notifyHR(ownerId ?? (people[0] as Person).user_id, {
      kind: 'hr_doc_paper_pending',
      title: `📋 ${hrPending.length} 人尚有正本紙本未收`,
      body: `以下人員的正本紙本尚未收到／勾選：\n${hrPending.slice(0, 30).join('\n')}${hrPending.length > 30 ? '\n…' : ''}\n\n收到後請至人員資料勾選「紙本已收」。`,
    }).catch(() => {})
  }

  return { notified, hr_pending: hrPending.length }
}
