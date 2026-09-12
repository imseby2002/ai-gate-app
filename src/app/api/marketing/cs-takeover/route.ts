/**
 * POST /api/marketing/cs-takeover
 * 切換某客戶對話的「真人接管 / AI 自動回覆」狀態。
 *  - takeover=true ：建立 open 人工客服工單 → webhook 讓 AI 靜音
 *  - takeover=false：將該客戶的 open 人工客服工單標記 resolved → AI 恢復自動回覆
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { platform, industry = 'homestay', takeover } = body
  const to = body.to || body.from_id
  if (!to) return NextResponse.json({ error: '缺少 to' }, { status: 400 })

  const admin = await createAdminClient()
  const now = new Date().toISOString()

  if (takeover) {
    const { data: open } = await admin
      .from('cs_tickets').select('id, created_at')
      .eq('user_id', ctx.ownerId).eq('from_id', to)
      .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (!open?.length) {
      const { error } = await admin.from('cs_tickets').insert({
        user_id: ctx.ownerId, industry, platform: platform ?? 'test', from_id: to,
        subject: '手動接管中（AI 已暫停）', description: '客服人員已於收件匣手動暫停 AI',
        priority: 'high', intent: '人工客服請求', status: 'open',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // 確保工單時間刷新為當前時間，維持有效接管窗口 2 小時
      await admin.from('cs_tickets').update({
        created_at: now,
        updated_at: now,
        status: 'open',
      }).eq('id', open[0].id)
    }
    return NextResponse.json({ ok: true, takeover: true })
  }

  // 恢復 AI：關閉所有 open 人工客服工單
  const { error } = await admin
    .from('cs_tickets')
    .update({ status: 'resolved', updated_at: now })
    .eq('user_id', ctx.ownerId).eq('from_id', to)
    .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, takeover: false })
}
