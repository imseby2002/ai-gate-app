/**
 * GET /api/agent/ig-test — 測試 Instagram 連線（唯讀）
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { loadMarketingPublishAccounts } from '@/lib/channels/resolve'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const publishAccounts = await loadMarketingPublishAccounts(ctx.ownerId)
  let creds = publishAccounts.Instagram?.credentials
  let source = publishAccounts.Instagram ? `官方帳號（${publishAccounts.Instagram.name}）` : '行銷平台設定'

  if (!creds?.access_token || !creds?.ig_user_id) {
    const { data: row } = await supabase
      .from('social_platform_credentials')
      .select('credentials, is_connected')
      .eq('user_id', ctx.ownerId)
      .eq('platform', 'Instagram')
      .maybeSingle()
    const rcreds = (row?.credentials as Record<string, string> | null) ?? {}
    if (rcreds.access_token && rcreds.ig_user_id) {
      creds = rcreds
      source = '行銷平台設定'
    }
  }

  if (!creds?.access_token || !creds?.ig_user_id) {
    return NextResponse.json({
      ok: false,
      error: 'Instagram 的 Access Token 與 IG User ID 需填寫',
    }, { status: 400 })
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${creds.ig_user_id}?fields=id,username,name&access_token=${creds.access_token}`)
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({
        ok: false,
        source,
        igUserId: creds.ig_user_id,
        error: `${data.error.message}（代碼 ${data.error.code}）`,
        hint: '請確認 Access Token 是否具有 instagram_basic、instagram_content_publish 權限，且與 IG 專業/商業帳號連結。',
      })
    }

    return NextResponse.json({
      ok: true,
      source,
      igUserId: data.id ?? creds.ig_user_id,
      username: data.username,
      name: data.name,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 502 })
  }
}
