/**
 * GET/POST /api/marketing/geo/settings
 * GEO Writer — 每位使用者的發佈設定（WordPress 憑證 / 通用 Webhook）。
 * 另含第三方平台（Medium、Ghost、Notion、Dev.to、Blogger）設定，存在 platforms jsonb。
 * GET 不回傳密碼明文，只回傳是否已設定；POST 密碼/Token 留空代表沿用既有值。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GeoPlatformSettings } from '@/lib/geo/platforms'
import { BLOGGER_PROVIDER } from '@/lib/geo/blogger-token'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('geo_publish_settings')
    .select('wp_base_url, wp_user, wp_app_password, webhook_url, webhook_token, platforms')
    .eq('user_id', user.id)
    .single()
  const p = (data?.platforms ?? {}) as GeoPlatformSettings
  const [{ data: blogger }, { data: fb }] = await Promise.all([
    supabase.from('user_integrations').select('email').eq('user_id', user.id).eq('provider', BLOGGER_PROVIDER).maybeSingle(),
    supabase.from('social_platform_credentials').select('credentials').eq('user_id', user.id).eq('platform', 'Facebook').limit(1).maybeSingle(),
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wpBaseUrl, wpUser, wpAppPassword, webhookUrl, webhookToken, platforms: pIn } = await req.json()

  // 取既有值，密碼/Token 留空時沿用
  const { data: prev } = await supabase
    .from('geo_publish_settings')
    .select('wp_app_password, webhook_token, platforms')
    .eq('user_id', user.id)
    .single()

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
    user_id: user.id,
    wp_base_url: wpBaseUrl?.trim() || null,
    wp_user: wpUser?.trim() || null,
    wp_app_password: wpAppPassword?.trim() ? wpAppPassword.trim() : (prev?.wp_app_password ?? null),
    webhook_url: webhookUrl?.trim() || null,
    webhook_token: webhookToken?.trim() ? webhookToken.trim() : (prev?.webhook_token ?? null),
    platforms,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('geo_publish_settings').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[geo/settings] upsert', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
