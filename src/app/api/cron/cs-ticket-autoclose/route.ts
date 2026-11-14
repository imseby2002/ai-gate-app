/**
 * GET /api/cron/cs-ticket-autoclose  （Vercel Cron，每小時）
 *
 * 客服工單（cs_tickets）建立超過 48 小時仍未結案（open / in_progress）→ 自動設為 resolved，
 * 避免收件匣「需要真人」提醒與工單列表被過期工單塞滿。
 * 48 小時遠超過真人接管時效（員工閒置分鐘、客人要求真人 2 小時），結案不影響 AI 是否回覆。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'

const AUTO_CLOSE_HOURS = 48

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const cutoff = new Date(Date.now() - AUTO_CLOSE_HOURS * 3600_000).toISOString()
  const { data, error } = await createAdminClient()
    .from('cs_tickets')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .in('status', ['open', 'in_progress'])
    .lt('created_at', cutoff)
    .select('id')
  if (error) {
    console.error('[cs-ticket-autoclose]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ closed: data?.length ?? 0 })
}
