/**
 * POST /api/ivr/webhook/zalo
 * Zalo 回報：ZNS 送達狀態 / OA follow（加入官方帳號）事件。
 * - 送達 → 補記 delivered_at
 * - follow/互動 → 回填對應 ivr_join_event.joined_at（依手機號對應最近一筆未完成的 zalo 事件）
 *
 * 公開端點（來自 Zalo，無 session），以 service role 寫入。
 * 簽章驗證：SHA256(ZALO_OA_SECRET + rawBody + timestamp)，標頭 X-ZEvent-Signature。
 * TODO: 確認實際 event_name 與欄位。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyZaloSignature } from '@/lib/ivr/verify'

const FOLLOW_EVENTS = new Set([
  'follow', 'user_follow_oa', 'oa_follow', 'user_received_message', 'user_send_text',
])
const DELIVERED_EVENTS = new Set([
  'zns_delivered', 'delivered', 'user_received_zns',
])

export async function POST(req: NextRequest) {
  const sb = createAdminClient()

  const rawBody = await req.text()
  let payload: Record<string, any> | null = null
  try { payload = JSON.parse(rawBody) } catch { payload = null }
  if (!payload) return NextResponse.json({ error: 'bad_payload' }, { status: 400 })

  const signature = req.headers.get('x-zevent-signature')
  if (!verifyZaloSignature(rawBody, signature, payload.timestamp)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const eventName: string = String(payload.event_name || payload.event || '').toLowerCase()
  // Zalo 可能以 user_id_by_app 或 tracking_id 帶手機；先涵蓋常見命名
  const phone: string | undefined =
    payload.phone || payload?.recipient?.phone || payload?.message?.phone || payload.tracking_id

  if (!phone) return NextResponse.json({ ok: true, note: 'no_phone' })

  // 找此手機相關的通話 → zalo join 事件
  const { data: calls } = await sb.from('ivr_calls').select('id').eq('phone', phone)
  const callIds = (calls ?? []).map((c) => c.id)
  if (callIds.length === 0) return NextResponse.json({ ok: true, note: 'no_call' })

  const { data: event } = await sb
    .from('ivr_join_events')
    .select('id, delivered_at, joined_at')
    .in('call_id', callIds)
    .eq('channel', 'zalo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!event) return NextResponse.json({ ok: true, note: 'no_event' })

  const patch: Record<string, unknown> = {}
  if (DELIVERED_EVENTS.has(eventName) && !event.delivered_at) {
    patch.delivered_at = new Date().toISOString()
  }
  if (FOLLOW_EVENTS.has(eventName) && !event.joined_at) {
    patch.joined_at = new Date().toISOString()
  }
  if (Object.keys(patch).length) {
    await sb.from('ivr_join_events').update(patch).eq('id', event.id)
  }

  return NextResponse.json({ ok: true, updated: Object.keys(patch) })
}
