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
  return NextResponse.json({ total: results.length, success, results })
}
