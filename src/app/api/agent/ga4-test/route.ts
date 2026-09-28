/**
 * GET /api/agent/ga4-test — 測試 GA4 連線（唯讀：讀近 7 天 sessions／使用者數）
 * 憑證沿用行銷自動化「平台設定」的 GA4（與 /api/social/credentials 同一個 ownerId）。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { ga4CredsFrom, getGa4Report } from '@/lib/marketing/ga4'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('social_platform_credentials')
    .select('credentials, is_connected')
    .eq('user_id', ctx.ownerId)
    .eq('platform', 'GA4')
    .maybeSingle()

  const creds = ga4CredsFrom(row?.credentials as Record<string, string> | null)
  if (!creds) {
    return NextResponse.json({ ok: false, error: 'GA4 資源 ID 與服務帳戶 JSON 金鑰需全部填寫，且金鑰需為完整 JSON' }, { status: 400 })
  }

  try {
    const report = await getGa4Report(creds, '7daysAgo', 'today')
    return NextResponse.json({ ok: true, propertyId: creds.propertyId, serviceAccount: creds.clientEmail, totals_last_7d: report.totals })
  } catch (e) {
    return NextResponse.json({ ok: false, propertyId: creds.propertyId, serviceAccount: creds.clientEmail, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
