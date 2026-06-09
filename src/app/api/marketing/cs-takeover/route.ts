/**
 * POST /api/marketing/cs-takeover
 * 切換某客戶對話的「真人接管 / AI 自動回覆」狀態。
 *  - takeover=true ：建立 open 人工客服工單 → webhook 讓 AI 靜音
 *  - takeover=false：將該客戶的 open 人工客服工單標記 resolved → AI 恢復自動回覆
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, to, industry = 'homestay', takeover } = await req.json()
  if (!to) return NextResponse.json({ error: '缺少 to' }, { status: 400 })

  if (takeover) {
    const { data: open } = await supabase
      .from('cs_tickets').select('id')
      .eq('user_id', ctx.ownerId).eq('from_id', to)
      .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
      .limit(1)
    if (!open?.length) {
      const { error } = await supabase.from('cs_tickets').insert({
        user_id: ctx.ownerId, industry, platform: platform ?? 'test', from_id: to,
        subject: '真人接管中', description: '客服人員已於收件匣接手此對話',
        priority: 'high', intent: '人工客服請求', status: 'open',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, takeover: true })
  }

  // 恢復 AI：關閉所有 open 人工客服工單
  const { error } = await supabase
    .from('cs_tickets')
    .update({ status: 'resolved' })
    .eq('user_id', ctx.ownerId).eq('from_id', to)
    .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, takeover: false })
}
