/**
 * GET /api/agent/meta-ads-test — 測試 Meta 廣告連線（唯讀：只讀帳戶資訊與近 30 天成效，不建立廣告、不花錢）
 * 憑證沿用行銷自動化「平台設定」的 Facebook（與 /api/social/credentials 同一個 ownerId）。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getAdAccount, getInsights, metaAdsCredsFrom } from '@/lib/marketing/meta-ads'

// https://developers.facebook.com/docs/marketing-api/reference/ad-account/ account_status
const ACCOUNT_STATUS: Record<number, string> = {
  1: '正常', 2: '已停用', 3: '未結清款項', 7: '審查中', 8: '待結算', 9: '寬限期', 100: '待關閉', 101: '已關閉',
}

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('social_platform_credentials')
    .select('credentials, is_connected')
    .eq('user_id', ctx.ownerId)
    .eq('platform', 'Facebook')
    .maybeSingle()

  const creds = metaAdsCredsFrom(row?.credentials as Record<string, string> | null)
  if (!creds) {
    return NextResponse.json({ ok: false, error: 'Facebook 的 Page Access Token、Page ID、廣告帳戶 ID 需全部填寫' }, { status: 400 })
  }

  try {
    const account = await getAdAccount(creds)
    const insights = await getInsights(creds, { datePreset: 'last_30d' })
    return NextResponse.json({
      ok: account.account_status === 1,
      adAccountId: creds.adAccountId,
      account: { ...account, status_label: ACCOUNT_STATUS[account.account_status] ?? String(account.account_status) },
      insights_last_30d: insights,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, adAccountId: creds.adAccountId, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
