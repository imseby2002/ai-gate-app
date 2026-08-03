/**
 * GET  /api/public/cs-form/[slug]  — 公開讀取表單定義（給 /f/[slug] 頁面渲染，不需登入）
 * POST /api/public/cs-form/[slug]  — 公開提交表單（客人掃碼/點連結填寫送出，不需登入）
 *
 * 用 service role 存取：這條路徑本來就是給「不是我們客戶」的訪客用，
 * 沒有 Supabase session 可言，一律靠自己的驗證（表單必須 enabled）把關。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'
import { formatFormSubmission, notifyFormSubmission } from '@/lib/cs/formNotify'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cs_forms')
    .select('id, name, fields, enabled')
    .eq('slug', slug)
    .single()

  if (error || !data || !data.enabled) return NextResponse.json({ error: '找不到這份表單，或表單已停用' }, { status: 404 })
  return NextResponse.json({ form: { id: data.id, name: data.name, fields: data.fields as CsFormField[] } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: form } = await supabase
    .from('cs_forms')
    .select('id, user_id, industry, name, fields, notify_target, enabled')
    .eq('slug', slug)
    .single()

  if (!form || !form.enabled) return NextResponse.json({ error: '找不到這份表單，或表單已停用' }, { status: 404 })

  const body = await req.json()
  const answers = body?.answers
  if (!answers || typeof answers !== 'object') return NextResponse.json({ error: '缺少回答內容' }, { status: 400 })

  const fields = (form.fields as CsFormField[]) ?? []
  for (const f of fields) {
    if (f.required && !String(answers[f.id] ?? '').trim()) {
      return NextResponse.json({ error: `「${f.label}」為必填` }, { status: 400 })
    }
  }

  const roomRef = typeof body?.roomRef === 'string' ? body.roomRef.trim().slice(0, 100) : null
  const notifyTarget = form.notify_target as CsFormNotifyTarget | null

  const { error } = await supabase
    .from('cs_form_submissions')
    .insert({
      form_id: form.id,
      user_id: form.user_id,
      industry: form.industry,
      answers,
      room_ref: roomRef,
      source: 'public_form',
      ...(notifyTarget?.batchMode === 'immediate' ? { notified_at: new Date().toISOString() } : {}),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (notifyTarget?.batchMode === 'immediate') {
    void notifyFormSubmission(form.user_id, notifyTarget, form.name, formatFormSubmission(form.name, fields, answers, roomRef))
  }

  return NextResponse.json({ ok: true })
}
