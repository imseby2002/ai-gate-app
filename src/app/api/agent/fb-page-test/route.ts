/**
 * GET /api/agent/fb-page-test — 測試 Facebook 粉絲專頁發文權限（唯讀）
 * 只檢查發文必要條件：Token 有 pages_manage_posts，且在該粉專的角色可建立內容。
 * 不讀需要 pages_read_engagement 的欄位（link、can_post），缺該權限只列為提醒。
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
    const token = creds.page_access_token
    const pageId = creds.page_id
    const g = async (path: string, tk: string) => (await fetch(`https://graph.facebook.com/v19.0/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tk)}`)).json()

    // 1) Token 本身授予的權限（發文只需要 pages_manage_posts；pages_read_engagement 只影響讀取互動數據）
    const perms = await g('me/permissions', token)
    const granted: string[] = Array.isArray(perms?.data) ? perms.data.filter((x: { status?: string }) => x.status === 'granted').map((x: { permission: string }) => x.permission) : []
    if (perms?.error?.code === 190) {
      return NextResponse.json({ ok: false, source, pageId, error: `${perms.error.message}（代碼 190）`, hint: 'Token 已過期或無效，請重新產生。' })
    }

    // 2) 以 pages_show_list 列出可管理的粉專與角色（tasks），不需要 pages_read_engagement
    const accounts = await g('me/accounts?fields=id,name,tasks&limit=100', token)
    const page = (Array.isArray(accounts?.data) ? accounts.data : []).find((x: { id: string }) => x.id === pageId) as { id: string; name?: string; tasks?: string[] } | undefined

    // 3) Token 直接是 Page Token 時 me/accounts 找不到：改讀粉專基本資料
    let pageName = page?.name
    const tasks: string[] = page?.tasks ?? []
    let readNote = ''
    if (!page) {
      const { pageToken } = await resolvePageToken(token, pageId)
      const info = await g(`${pageId}?fields=id,name`, pageToken)
      if (info?.error) {
        if (info.error.code === 190) {
          return NextResponse.json({ ok: false, source, pageId, error: `${info.error.message}（代碼 190）`, hint: 'Token 已過期或無效，請重新產生。' })
        }
        readNote = `無法讀取粉專基本資料（${info.error.message}，代碼 ${info.error.code}）`
      } else pageName = info?.name
    }

    const hasManage = granted.length === 0 || granted.includes('pages_manage_posts')
    const roleOk = tasks.length === 0 || tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE')
    const missingRead = granted.length > 0 && !granted.includes('pages_read_engagement')

    if (!hasManage || !roleOk) {
      return NextResponse.json({
        ok: false, source, pageId, pageName, tasks, granted,
        error: !hasManage
          ? `此 Token 沒有 pages_manage_posts 權限，無法發文（已授權：${granted.join(', ') || '無'}）`
          : `此 Token 在粉專「${pageName ?? pageId}」的角色沒有建立內容權限（tasks: ${tasks.join(', ')}）`,
        hint: '請重新產生 Token 並勾選 pages_manage_posts + pages_show_list；System User 需在 Business Manager 指派粉專資產與「建立內容」權限。',
      })
    }

    return NextResponse.json({
      ok: true, source, pageId, pageName: pageName ?? pageId, canPost: true, tasks, granted,
      // 不影響發文的提醒：缺 pages_read_engagement 時無法讀取貼文互動數據
      warning: [missingRead ? '缺少 pages_read_engagement：可以發文，但無法讀取貼文互動數據' : '', readNote].filter(Boolean).join('；') || undefined,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 502 })
  }
}
