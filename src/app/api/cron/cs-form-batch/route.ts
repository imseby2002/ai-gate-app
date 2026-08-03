/**
 * GET /api/cron/cs-form-batch （Vercel Cron，每 15 分鐘）
 *
 * 自建表單（cs_forms）batchMode='daily' 的彙整通知：把當天累積、尚未通知
 * 的提交紀錄合併成「一則」訊息送出，避免 LINE OA 每筆都推播、超出月配額。
 * batchMode='immediate' 的表單在提交當下就已經送出（見 formNotify.ts），不會進到這裡。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyFormSubmission, formatFormSubmissionBatch } from '@/lib/cs/formNotify'
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
  const results: Array<{ formId: string; submissions: number; ok: boolean }> = []

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
    await notifyFormSubmission(form.user_id, notifyTarget, form.name, text)

    await supabase
      .from('cs_form_submissions')
      .update({ notified_at: new Date().toISOString() })
      .in('id', submissions.map(s => s.id))

    sent++
    results.push({ formId: form.id, submissions: submissions.length, ok: true })
  }

  return NextResponse.json({ formsChecked: forms?.length ?? 0, sent, results })
}
