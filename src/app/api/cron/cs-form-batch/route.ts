/**
 * GET /api/cron/cs-form-batch （Vercel Cron，每 15 分鐘）
 *
 * 1. 自建表單（cs_forms）batchMode='daily' 的彙整通知：把當天累積、尚未通知
 *    的提交紀錄合併成「一則」訊息送出，避免 LINE OA 每筆都推播、超出月配額。
 * 2. 補救重試：batchMode='immediate' 的表單在提交當下就會嘗試送出（見
 *    /api/public/cs-form/[slug]、cs-webhook 的 saveFormSubmissionFromChat），
 *    但那條路徑失敗後（例如 LINE token 失效）沒有任何重試機制——真實案例：客人
 *    透過公開表單訂了早餐，通知因為送不出去而完全沒有人收到。這裡額外掃過去
 *    10 分鐘前、還沒通知成功的提交紀錄（不限 daily），逐筆重試一次。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyFormSubmission, formatFormSubmission, formatFormSubmissionBatch } from '@/lib/cs/formNotify'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'

// batchTime（HH:MM）與現在台灣時間的差距落在這個範圍內（分鐘）才觸發，
// 對齊 15 分鐘的執行頻率，同一天內不會重複觸發（見下方 notified_at 去重）。
const FIRE_WINDOW_MIN = 15

function minutesSinceMidnight(hhmm: string): number | null {
  const m = hhmm.match(/^([0-2]?[0-9]):([0-5][0-9])$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const nowHHMM = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' })
  const nowMinutes = minutesSinceMidnight(nowHHMM)!

  const { data: forms } = await supabase
    .from('cs_forms')
    .select('id, user_id, name, fields, notify_target')
    .eq('enabled', true)

  let sent = 0
  const results: Array<{ formId: string; submissions: number; ok: boolean; error?: string }> = []

  for (const form of forms ?? []) {
    const notifyTarget = form.notify_target as CsFormNotifyTarget | null
    if (!notifyTarget || notifyTarget.batchMode !== 'daily' || !notifyTarget.platform || !notifyTarget.to) continue

    const targetMinutes = minutesSinceMidnight(notifyTarget.batchTime)
    if (targetMinutes === null) continue
    const diff = (nowMinutes - targetMinutes + 1440) % 1440
    if (diff < 0 || diff >= FIRE_WINDOW_MIN) continue

    const { data: submissions } = await supabase
      .from('cs_form_submissions')
      .select('id, answers, room_ref, created_at')
      .eq('form_id', form.id)
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(200)

    if (!submissions?.length) continue

    const text = formatFormSubmissionBatch(form.name, (form.fields as CsFormField[]) ?? [], submissions)
    const result = await notifyFormSubmission(form.user_id, notifyTarget, form.name, text)

    await supabase
      .from('cs_form_submissions')
      .update(result.ok ? { notified_at: new Date().toISOString() } : { notify_error: result.error ?? '未知錯誤' })
      .in('id', submissions.map(s => s.id))

    if (result.ok) sent++
    results.push({ formId: form.id, submissions: submissions.length, ok: result.ok, error: result.error })
  }

  // 補救重試：immediate 表單在提交當下沒送成功就沒有其他重試機會了（daily 表單已經
  // 在上面處理過，這裡用 form_id not in 已處理清單排除，避免重複通知）。
  // 只抓 10 分鐘前的紀錄，避免跟剛送出、還在走 immediate 路徑的提交搶著重試。
  const dailyFormIds = new Set((forms ?? [])
    .filter(f => (f.notify_target as CsFormNotifyTarget | null)?.batchMode === 'daily')
    .map(f => f.id))
  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()

  let retried = 0
  const retryResults: Array<{ submissionId: string; ok: boolean; error?: string }> = []
  const formById = new Map((forms ?? []).map(f => [f.id, f]))

  const { data: orphaned } = await supabase
    .from('cs_form_submissions')
    .select('id, form_id, answers, room_ref, created_at')
    .is('notified_at', null)
    .lt('created_at', tenMinAgo)
    .order('created_at', { ascending: true })
    .limit(100)

  for (const sub of orphaned ?? []) {
    if (dailyFormIds.has(sub.form_id)) continue  // daily 的已經在上面批次處理過
    const form = formById.get(sub.form_id)
    const notifyTarget = form?.notify_target as CsFormNotifyTarget | null
    if (!form || !notifyTarget?.platform || !notifyTarget.to) continue

    const text = formatFormSubmission(form.name, (form.fields as CsFormField[]) ?? [], sub.answers as Record<string, string>, sub.room_ref)
    const result = await notifyFormSubmission(form.user_id, notifyTarget, form.name, text, {
      fields: (form.fields as CsFormField[]) ?? [], answers: sub.answers as Record<string, string>, roomRef: sub.room_ref,
    })

    await supabase
      .from('cs_form_submissions')
      .update(result.ok ? { notified_at: new Date().toISOString(), notify_error: null } : { notify_error: result.error ?? '未知錯誤' })
      .eq('id', sub.id)

    if (result.ok) retried++
    retryResults.push({ submissionId: sub.id, ok: result.ok, error: result.error })
  }

  return NextResponse.json({ formsChecked: forms?.length ?? 0, sent, results, retried, retryResults })
}
