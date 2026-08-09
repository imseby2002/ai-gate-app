/**
 * POST /api/marketing/email-send
 * 批次寄送行銷 Email（Resend）
 *
 * 寄件人一律使用系統環境變數（RESEND_FROM_EMAIL / RESEND_FROM_NAME），
 * 不接受前端指定，避免客戶填錯網域被 Resend 退信。
 *
 * Body: {
 *   recipients: { email: string; group?: string; name?: string }[]
 *   groups: { [group: string]: { subject: string; body: string } }
 *   defaultSubject: string
 *   defaultBody: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { EMAIL_COST, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export async function POST(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    recipients = [],
    groups = {},
    defaultSubject = '行銷訊息',
    defaultBody = '',
  } = body

  // 寄件人統一由系統環境變數決定，忽略前端傳入的值
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
  const fromName = process.env.RESEND_FROM_NAME ?? 'AI Gate 行銷'

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: '請設定環境變數 RESEND_API_KEY' }, { status: 500 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  if (recipients.length === 0) {
    return NextResponse.json({ error: '收件人清單為空' }, { status: 400 })
  }

  // cron 觸發（isCron=true）沒有真實使用者 session，是系統內部動作，不受方案／點數限制
  // （比照這支 route 既有設計：cron 只呼叫已驗證過的既有排程，不需要重複驗證特定使用者）。
  // 互動觸發才走方案 gate ＋ 點數扣款；admin/employee 依全站慣例不計費。
  const billable = !user.isCron && await isBillableUser(user.id)
  if (!user.isCron) {
    const { plan, features } = await getMarketingEntitlements(null, user.id)
    if (!features.aiCallEmail && features.prospectMarketing === 'collectOnly') {
      return NextResponse.json({ error: '目前方案未開放 Email 行銷，請升級至 PRO 以上', plan }, { status: 403 })
    }
    const check = await checkCredits(user.id, EMAIL_COST * recipients.length, billable)
    if (!check.ok) return NextResponse.json(check.payload, { status: 402 })
  }

  const results: { email: string; group: string; ok: boolean; id?: string; error?: string }[] = []

  // Send in batches of 10 to avoid rate limits
  const BATCH = 10
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    await Promise.all(batch.map(async (r: { email: string; group?: string; name?: string }) => {
      const group = r.group ?? 'default'
      const tpl = groups[group] ?? groups['default']
      const subject = tpl?.subject || defaultSubject
      const body   = tpl?.body    || defaultBody

      try {
        const { data, error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [r.email],
          subject,
          html: body.replace(/\n/g, '<br>'),
          text: body,
        })
        if (error) throw new Error(error.message)
        results.push({ email: r.email, group, ok: true, id: data?.id })
      } catch (e) {
        results.push({ email: r.email, group, ok: false, error: String(e) })
      }
    }))
  }

  const success = results.filter(r => r.ok).length
  if (success > 0 && !user.isCron) {
    await deductCredits(user.id, EMAIL_COST * success, `[marketing] 行銷 Email 寄送 ${success} 封`, billable)
  }
  return NextResponse.json({ total: results.length, success, results })
}
