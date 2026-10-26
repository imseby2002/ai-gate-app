/**
 * GET /api/agent/fb-page-test — 測試 Facebook 粉絲專頁發文權限（唯讀）
 * 檢驗 Token 是否具備 pages_manage_posts / pages_read_engagement / pages_show_list 等發文權限
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { loadMarketingPublishAccounts } from '@/lib/channels/resolve'
import { resolvePageToken } from '@/lib/marketing/publish'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. 優先由公司官方帳號（統一管理中心）取得 Facebook 憑證
  const publishAccounts = await loadMarketingPublishAccounts(ctx.ownerId)
  let creds = publishAccounts.Facebook?.credentials
  let source = publishAccounts.Facebook ? `官方帳號（${publishAccounts.Facebook.name}）` : '行銷平台設定'

  // 2. 若官方帳號未設定，退回讀取行銷平台個別設定
  if (!creds?.page_access_token || !creds?.page_id) {
    const { data: row } = await supabase
      .from('social_platform_credentials')
      .select('credentials, is_connected')
      .eq('user_id', ctx.ownerId)
      .eq('platform', 'Facebook')
      .maybeSingle()
    const rcreds = (row?.credentials as Record<string, string> | null) ?? {}
    if (rcreds.page_access_token && rcreds.page_id) {
      creds = rcreds
      source = '行銷平台設定'
    }
  }

  if (!creds?.page_access_token || !creds?.page_id) {
    return NextResponse.json({
      ok: false,
      error: 'Facebook 的 Page Access Token 與 Page ID 需填寫',
    }, { status: 400 })
  }

  try {
    const { pageToken, debug } = await resolvePageToken(creds.page_access_token, creds.page_id)
    const res = await fetch(`https://graph.facebook.com/v19.0/${creds.page_id}?fields=id,name,link,tasks,can_post&access_token=${pageToken}`)
    const data = await res.json()

    if (data.error) {
      const errCode = data.error.code
      const errMsg = data.error.message ?? '存取粉絲專頁失敗'
      let hint = ''
      if (errCode === 200 || errCode === 100) {
        hint = 'Token 缺少 pages_manage_posts 或 pages_read_engagement 權限；若是 System User Token，請在 Business Manager 同時勾選 pages_manage_posts + pages_read_engagement + pages_show_list，並確認已指派粉專資產。'
      } else if (errCode === 190) {
        hint = 'Token 已過期或無效，請重新產生。'
      }
      return NextResponse.json({
        ok: false,
        source,
        pageId: creds.page_id,
        error: `${errMsg}（代碼 ${errCode}）`,
        hint,
        debug,
      })
    }

    const tasks: string[] = Array.isArray(data.tasks) ? data.tasks : []
    const canPost = data.can_post !== false && (tasks.length === 0 || tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE'))

    if (!canPost) {
      return NextResponse.json({
        ok: false,
        source,
        pageId: data.id ?? creds.page_id,
        pageName: data.name,
        error: `已連線到粉絲專頁「${data.name}」，但此 Token 缺少發文權限（tasks: ${tasks.join(', ') || '無'}，can_post=${data.can_post}）。請確認 System User 或授權帳號已獲分配「建立內容 (CREATE_CONTENT)」或管理員權限。`,
        tasks,
      })
    }

    return NextResponse.json({
      ok: true,
      source,
      pageId: data.id ?? creds.page_id,
      pageName: data.name,
      canPost: true,
      tasks,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 502 })
  }
}
