/**
 * GET /api/ivr/r/[token]
 * IVR 短連結轉址：記錄首次點擊(clicked_at)後 302 導向實際加入連結。
 * 公開端點（客戶從訊息點入，無 session），以 service role 寫入。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const sb = createAdminClient()

  const { data: event } = await sb
    .from('ivr_join_events')
    .select('id, join_url, clicked_at')
    .eq('short_token', token)
    .single()

  if (!event?.join_url) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 僅記錄首次點擊
  if (!event.clicked_at) {
    await sb
      .from('ivr_join_events')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', event.id)
  }

  return NextResponse.redirect(event.join_url, 302)
}
