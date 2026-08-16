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
import { isFormAvailableToday } from '@/lib/cs/formSchedule'
import { resolveTodaySubmission, verifyRoomCheckedInToday } from '@/lib/cs/formSubmitGuard'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cs_forms')
    .select('id, name, fields, enabled, available_weekdays')
    .eq('slug', slug)
    .single()

  if (error || !data || !data.enabled) return NextResponse.json({ error: '找不到這份表單，或表單已停用' }, { status: 404 })
  if (!isFormAvailableToday(data.available_weekdays)) {
    return NextResponse.json({ error: '這份表單今天不開放填寫，請改天再來或聯繫我們。' }, { status: 403 })
  }
  return NextResponse.json({ form: { id: data.id, name: data.name, fields: data.fields as CsFormField[] } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: form } = await supabase
    .from('cs_forms')
    .select('id, user_id, industry, name, fields, notify_target, enabled, available_weekdays')
    .eq('slug', slug)
    .single()

  if (!form || !form.enabled) return NextResponse.json({ error: '找不到這份表單，或表單已停用' }, { status: 404 })
  if (!isFormAvailableToday(form.available_weekdays)) {
    return NextResponse.json({ error: '這份表單今天不開放填寫，請改天再來或聯繫我們。' }, { status: 403 })
  }

  const body = await req.json()
  const answers = body?.answers
  if (!answers || typeof answers !== 'object') return NextResponse.json({ error: '缺少回答內容' }, { status: 400 })

  const fields = (form.fields as CsFormField[]) ?? []
  for (const f of fields) {
    if (f.required && !String(answers[f.id] ?? '').trim()) {
      return NextResponse.json({ error: `「${f.label}」為必填` }, { status: 400 })
    }
  }

  const match = await resolveTodaySubmission(supabase, form.id, fields, answers)
  if (match.kind === 'duplicate') {
    return NextResponse.json({ error: '這筆內容今天已經送出過了，如需修改請直接聯繫我們' }, { status: 409 })
  }
  const roomCheck = await verifyRoomCheckedInToday(supabase, form.user_id, fields, answers)
  if (!roomCheck.ok) return NextResponse.json({ error: roomCheck.reason }, { status: 403 })

  const roomRef = typeof body?.roomRef === 'string' ? body.roomRef.trim().slice(0, 100) : null
  const notifyTarget = form.notify_target as CsFormNotifyTarget | null
  const isUpdate = match.kind === 'update'

  // 同一個房號當天已有紀錄、但這次答案不同 → 客人是在改原本的訂單，直接覆蓋原紀錄，
  // 不要另開一筆讓員工分不清哪筆才是最終版本（見 resolveTodaySubmission 註解）
  const { data: row, error } = isUpdate
    ? await supabase.from('cs_form_submissions')
        .update({ answers, room_ref: roomRef, updated_at: new Date().toISOString(), notified_at: null, notify_error: null })
        .eq('id', match.existingId!)
        .select('id')
        .single()
    : await supabase.from('cs_form_submissions')
        .insert({ form_id: form.id, user_id: form.user_id, industry: form.industry, answers, room_ref: roomRef, source: 'public_form' })
        .select('id')
        .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // notified_at 只在真的送出成功才標記——之前不管有沒有送成功都直接標記，
  // 客人透過公開表單訂了早餐，通知卻因為 LINE token 失效送不出去，沒有人知道。
  //
  // 這裡改成 await 而不是 void fire-and-forget：真實案例顯示「立即通知」設定下，
  // 訊息其實沒有真的立即送達，而是隔了將近 20 分鐘才由「孤兒補送」cron 撿到——
  // 這個 API route 一回應，serverless function 就可能被中止，還沒送出的 LINE push
  // 跟著被砍斷。公開表單本來就是單純的送出→等結果，await 多花的時間可以接受，
  // 換來「立即通知」名副其實。
  if (notifyTarget?.batchMode === 'immediate') {
    const result = await notifyFormSubmission(
      form.user_id, notifyTarget, form.name,
      formatFormSubmission(form.name, fields, answers, roomRef, isUpdate),
      { fields, answers, roomRef },
    )
    await supabase
      .from('cs_form_submissions')
      .update(result.ok ? { notified_at: new Date().toISOString() } : { notify_error: result.error ?? '未知錯誤' })
      .eq('id', row.id)
  }

  return NextResponse.json({ ok: true, updated: isUpdate })
}
