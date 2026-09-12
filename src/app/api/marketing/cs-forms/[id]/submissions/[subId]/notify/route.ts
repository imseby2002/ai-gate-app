/**
 * POST /api/marketing/cs-forms/[id]/submissions/[subId]/notify
 * 管家手動觸發單筆提交紀錄推播至目標管道（如船公司 LINE 群組）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { notifyFormSubmission, formatFormSubmission } from '@/lib/cs/formNotify'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'

type Params = { params: Promise<{ id: string; subId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, subId } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 確認表單權限
  const { data: form, error: fErr } = await supabase
    .from('cs_forms')
    .select('id, user_id, name, fields, notify_target')
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .single()

  if (fErr || !form) return NextResponse.json({ error: '找不到指定表單' }, { status: 404 })

  const notifyTarget = form.notify_target as CsFormNotifyTarget | null
  if (!notifyTarget || !notifyTarget.platform || !notifyTarget.to) {
    return NextResponse.json({ error: '此表單尚未設定通知目標（如 LINE/Telegram 群組）' }, { status: 400 })
  }

  // 取得該筆提交紀錄
  const { data: sub, error: sErr } = await supabase
    .from('cs_form_submissions')
    .select('*')
    .eq('id', subId)
    .eq('form_id', id)
    .single()

  if (sErr || !sub) return NextResponse.json({ error: '找不到指定提交紀錄' }, { status: 404 })

  const fields = (form.fields as CsFormField[]) ?? []
  const text = formatFormSubmission(form.name, fields, sub.answers as Record<string, string>, sub.room_ref)

  const result = await notifyFormSubmission(form.user_id, notifyTarget, form.name, text, {
    fields,
    answers: sub.answers as Record<string, string>,
    roomRef: sub.room_ref,
  })

  const now = new Date().toISOString()
  await supabase
    .from('cs_form_submissions')
    .update(result.ok ? { notified_at: now, notify_error: null } : { notify_error: result.error ?? '推播失敗' })
    .eq('id', subId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? '推播失敗' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, notified_at: now })
}
