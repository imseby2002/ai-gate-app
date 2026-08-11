/**
 * LINE 群組/個人 ID 查詢小工具。
 *
 * 用途：客服表單、通知設定常常需要填「LINE 群組 ID」或「個人 ID」，但 LINE 官方
 * 沒有地方直接顯示這組 ID——通常只能透過「暫時把某個 OA 的 Webhook 指到自己的
 * 伺服器、傳一則訊息、從收到的 webhook payload 裡讀出 source.groupId/userId」
 * 這種方式才拿得到。這支路由就是那個暫時的接收端：
 *
 * POST /api/tools/line-id-finder/[key] — LINE webhook 接收端（設定到 LINE
 *   Developers Console 的 Webhook URL），把每個事件的來源類型與 ID 存起來。
 * GET  /api/tools/line-id-finder/[key] — 給前端頁面輪詢，回傳最近捕捉到的 ID。
 *
 * key 是前端頁面亂數產生的一次性字串，不需要登入即可呼叫（LINE 伺服器本身也
 * 沒有登入身份），單純靠 key 夠長、夠隨機做區隔，不存放任何敏感資訊（只有
 * 訊息來源 ID 跟前幾個字，不記錄完整訊息內容）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface LineSource { type: string; userId?: string; groupId?: string; roomId?: string }
interface LineEvent { type: string; source?: LineSource; message?: { type: string; text?: string } }

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length < 16) return NextResponse.json({ ok: true }) // 忽略過短/不合理的 key，靜默回 200 給 LINE

  let body: { events?: LineEvent[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  for (const event of body.events ?? []) {
    const source = event.source
    if (!source) continue
    const sourceId = source.groupId ?? source.roomId ?? source.userId ?? null
    if (!sourceId) continue
    await admin.from('line_id_finder_captures').insert({
      session_key: key,
      source_type: source.type ?? 'unknown',
      source_id: sourceId,
      raw_text: event.message?.text?.slice(0, 100) ?? null,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!key || key.length < 16) return NextResponse.json({ captures: [] })

  const admin = createAdminClient()
  const { data } = await admin
    .from('line_id_finder_captures')
    .select('source_type, source_id, raw_text, created_at')
    .eq('session_key', key)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ captures: data ?? [] })
}
