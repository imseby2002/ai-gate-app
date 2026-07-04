import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { Resend } from 'resend'

// POST /api/marketing/cs-setup-request
// 民宿擁有者不會自己綁定頻道/設知識庫時，送出「找人幫我設定」請求。
// 存進 cs_setup_requests，並 email 通知客服人員跟進。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industry = 'homestay', contact = '', note = '' } = await req.json()

  const { data: row, error } = await supabase
    .from('cs_setup_requests')
    .insert({
      user_id: ctx.user.id,
      owner_id: ctx.ownerId,
      industry,
      contact: contact?.trim() || null,
      note: note?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const notifyTo = process.env.SUPPORT_NOTIFY_EMAIL ?? 'imseby@gmail.com'
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
      await resend.emails.send({
        from: `AI GATE 客服協助 <${fromEmail}>`,
        to: [notifyTo],
        subject: `[CS 設定協助] ${ctx.user.email ?? ctx.user.id} 提出請求`,
        text: [
          `帳號 email：${ctx.user.email ?? '（未知）'}`,
          `owner_id：${ctx.ownerId}`,
          `產業：${industry}`,
          `聯絡方式：${contact || '（未留）'}`,
          `留言：${note || '（無）'}`,
        ].join('\n'),
      })
    } catch {
      // 通知失敗不影響請求已存檔，忽略即可
    }
  }

  return NextResponse.json({ ok: true, id: row.id })
}
