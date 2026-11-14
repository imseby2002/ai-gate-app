/**
 * GET/POST /api/marketing/geo/settings
 * GEO Writer — 每位使用者的發佈設定（WordPress 憑證 / 通用 Webhook）。
 * 設定跟著「目前切換的公司」走（存在公司 owner 名下），同一個登入帳號切換公司就用各自的設定；
 * 公司還沒有設定時沿用登入者自己舊的設定。
 * 另含第三方平台（Medium、Ghost、Notion、Dev.to、Blogger）設定，存在 platforms jsonb。
 * GET 不回傳密碼明文，只回傳是否已設定；POST 密碼/Token 留空代表沿用既有值。
 */
import { NextRequest, NextResponse } from 'next/server'
import type { GeoPlatformSettings } from '@/lib/geo/platforms'
import { marketingCompany } from '@/lib/marketing/company'
import { loadGeoSettings } from '@/lib/geo/settings'
import { BLOGGER_PROVIDER } from '@/lib/geo/blogger-token'

export async function GET() {
  const mkt = await marketingCompany()
  if (!mkt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await loadGeoSettings(mkt)
  const p = (data?.platforms ?? {}) as GeoPlatformSettings
  const [{ data: blogger }, { data: fb }] = await Promise.all([
    mkt.admin.from('user_integrations').select('email').eq('user_id', mkt.ownerId).eq('provider', BLOGGER_PROVIDER).maybeSingle(),
    mkt.admin.from('social_platform_credentials').select('credentials').eq('user_id', mkt.ownerId).eq('platform', 'Facebook')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const fbCred = (fb?.credentials ?? null) as { page_id?: string; page_access_token?: string } | null

  return NextResponse.json({
    platforms: {
      mediumConfigured: !!p.medium?.token,
      ghostUrl: p.ghost?.url ?? '',
      ghostConfigured: !!p.ghost?.adminKey,
      notionParentPageId: p.notion?.parentPageId ?? '',
      notionConfigured: !!p.notion?.token,
      devtoConfigured: !!p.devto?.apiKey,
      bloggerUrl: p.blogger?.blogUrl ?? '',
      bloggerEmail: blogger?.email ?? null,
      facebookConnected: !!(fbCred?.page_id && fbCred?.page_access_token),
    },
    wpBaseUrl: data?.wp_base_url ?? '',
    wpUser: data?.wp_user ?? '',
    wpConfigured: !!data?.wp_app_password,
    webhookUrl: data?.webhook_url ?? '',
    webhookConfigured: !!data?.webhook_token,
  })
}

export async function POST(req: NextRequest) {
  const mkt = await marketingCompany()
  if (!mkt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wpBaseUrl, wpUser, wpAppPassword, webhookUrl, webhookToken, platforms: pIn } = await req.json()

  // 取既有值，密碼/Token 留空時沿用
  const prev = await loadGeoSettings(mkt)

  // 第三方平台：金鑰留空沿用舊值，非機密欄位直接覆蓋
  const old = (prev?.platforms ?? {}) as GeoPlatformSettings
  const inP = (pIn ?? {}) as Record<string, string | undefined>
  const keep = (v: string | undefined, o: string | undefined) => (v?.trim() ? v.trim() : o)
  const platforms: GeoPlatformSettings = {
    medium: { token: keep(inP.mediumToken, old.medium?.token) },
    ghost: { url: inP.ghostUrl !== undefined ? inP.ghostUrl.trim() : old.ghost?.url, adminKey: keep(inP.ghostAdminKey, old.ghost?.adminKey) },
    notion: { token: keep(inP.notionToken, old.notion?.token), parentPageId: inP.notionParentPageId !== undefined ? inP.notionParentPageId.trim() : old.notion?.parentPageId },
    devto: { apiKey: keep(inP.devtoApiKey, old.devto?.apiKey) },
    blogger: { blogUrl: inP.bloggerUrl !== undefined ? inP.bloggerUrl.trim() : old.blogger?.blogUrl },
  }

  const row = {
    user_id: mkt.ownerId,
    wp_base_url: wpBaseUrl?.trim() || null,
    wp_user: wpUser?.trim() || null,
    wp_app_password: wpAppPassword?.trim() ? wpAppPassword.trim() : (prev?.wp_app_password ?? null),
    webhook_url: webhookUrl?.trim() || null,
    webhook_token: webhookToken?.trim() ? webhookToken.trim() : (prev?.webhook_token ?? null),
    platforms,
    updated_at: new Date().toISOString(),
  }

  const { error } = await mkt.admin.from('geo_publish_settings').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[geo/settings] upsert', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
