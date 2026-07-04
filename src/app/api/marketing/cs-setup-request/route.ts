import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { Resend } from 'resend'

const MONTHLY_QUOTA = 2

// POST /api/marketing/cs-setup-request
// 民宿擁有者不會自己綁定頻道/設知識庫時，送出「找人幫我設定」請求。
// 存進 cs_setup_requests，並 email 通知客服人員跟進。
// 每間民宿（依 owner_id，不分哪個協作者送出）每月最多 MONTHLY_QUOTA 次。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industry = 'homestay', contact = '', note = '' } = await req.json()

  // 用 admin client 計數：RLS 只讓使用者看到自己送出的請求，
  // 但額度要以民宿（owner_id）為單位，涵蓋所有協作者送出的請求。
  const admin = createAdminClient()
  const nowTaipei = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const monthStart = `${nowTaipei.getFullYear()}-${String(nowTaipei.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
  const { count } = await admin
    .from('cs_setup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ctx.ownerId)
    .gte('created_at', monthStart)

  if ((count ?? 0) >= MONTHLY_QUOTA) {
    return NextResponse.json(
      { error: `本月已達 ${MONTHLY_QUOTA} 次協助設定申請上限，如需更多次請儲值後再申請或聯繫我們加購。` },
      { status: 429 },
    )
  }

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
