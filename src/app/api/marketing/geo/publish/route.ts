/**
 * POST /api/marketing/geo/publish
 * GEO Writer 步驟6 — 發佈，依不同使用者情境提供四種模式：
 *  - mode='landing'  ：本站 SSR 落地頁 /geo/<id>（免設定，任何人可用）
 *  - mode='wordpress'：WordPress 原生 REST 直發（情境一，含 Hostinger 上的 WP）
 *                      需 GEO_WP_BASE_URL / GEO_WP_USER / GEO_WP_APP_PASSWORD（應用程式密碼）
 *  - mode='webhook'  ：通用 webhook，POST 自訂 JSON 給對方 CMS/API（情境二A）
 *                      需 GEO_WORDPRESS_WEBHOOK（選用 GEO_WORDPRESS_TOKEN）
 *  - mode='export'   ：回傳獨立 HTML 文件字串供下載（情境二B/C，靜態網站/無後台）
 *
 *  - mode='facebook'|'blogger'|'medium'|'ghost'|'notion'|'devto'：發佈到第三方平台（見 lib/geo/platforms.ts）
 *
 * Body: { articleId: string; mode?: 'landing'|'wordpress'|'webhook'|'export'|GeoPlatform }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mdToHtml, buildStandaloneHtml, escapeJsonLd } from '@/lib/geo/md'
import { safeFetch } from '@/lib/ssrf'
import {
  GEO_PLATFORMS, publishBlogger, publishDevto, publishFacebook, publishGhost, publishMedium, publishNotion,
  type GeoPlatform, type GeoPlatformSettings,
} from '@/lib/geo/platforms'
import { getValidBloggerAccessToken } from '@/lib/geo/blogger-token'
import { marketingCompany } from '@/lib/marketing/company'
import { loadGeoSettings } from '@/lib/geo/settings'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, mode = 'landing' } = await req.json()
  if (!articleId) return NextResponse.json({ error: '缺少 articleId' }, { status: 400 })

  const { data: article } = await supabase
    .from('geo_articles')
    .select('id, title, body_md, json_ld, published_url')
    .eq('id', articleId)
    .single()
  if (!article) return NextResponse.json({ error: '找不到文章' }, { status: 404 })

  // 目前切換公司的發佈設定（存在公司 owner 名下；沒有則用登入者自己的），未設則退回 env
  const mkt = await marketingCompany()
  if (!mkt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await loadGeoSettings(mkt)

  const bodyHtml = mdToHtml(article.body_md)
  const jsonLdStr = article.json_ld
    ? (typeof article.json_ld === 'string' ? article.json_ld : JSON.stringify(article.json_ld))
    : null
  const markPublished = (url: string | null) =>
    supabase.from('geo_articles').update({ status: 'published', published_url: url }).eq('id', articleId)

  // ── 匯出獨立 HTML（不寫 DB，前端負責下載）──
  if (mode === 'export') {
    const html = buildStandaloneHtml(article.title, bodyHtml, jsonLdStr)
    const filename = `${article.title.replace(/[^\w一-龥-]+/g, '_').slice(0, 50) || 'geo-article'}.html`
    return NextResponse.json({ mode, html, filename })
  }

  // ── WordPress 原生 REST 直發 ──
  if (mode === 'wordpress') {
    const base = settings?.wp_base_url || process.env.GEO_WP_BASE_URL
    const wpUser = settings?.wp_user || process.env.GEO_WP_USER
    const appPw = settings?.wp_app_password || process.env.GEO_WP_APP_PASSWORD
    if (!base || !wpUser || !appPw) {
      return NextResponse.json(
        { error: '尚未設定 WordPress：請在「發佈設定」填入網址、帳號與應用程式密碼' },
        { status: 400 },
      )
    }
    const content = jsonLdStr
      ? `${bodyHtml}\n<script type="application/ld+json">${escapeJsonLd(jsonLdStr)}</script>`
      : bodyHtml
    let link = ''
    try {
      const auth = Buffer.from(`${wpUser}:${appPw}`).toString('base64')
      const res = await fetch(`${base.replace(/\/$/, '')}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({ title: article.title, content, status: 'publish' }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`WP ${res.status} ${detail.slice(0, 200)}`)
      }
      const data = await res.json()
      link = data.link || ''
    } catch (err) {
      console.error('[geo/publish] wordpress', err)
      return NextResponse.json({ error: `WordPress 發佈失敗：${String(err)}` }, { status: 502 })
    }
    await markPublished(link || null)
    return NextResponse.json({ mode, url: link })
  }

  // ── 通用 webhook（對方 CMS/API 自行接收）──
  if (mode === 'webhook') {
    const hook = settings?.webhook_url || process.env.GEO_WORDPRESS_WEBHOOK
    const hookToken = settings?.webhook_token || process.env.GEO_WORDPRESS_TOKEN
    if (!hook) return NextResponse.json({ error: '尚未設定 Webhook：請在「發佈設定」填入 Webhook 網址' }, { status: 400 })
    let publishedUrl = ''
    try {
      const res = await safeFetch(hook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hookToken ? { Authorization: `Bearer ${hookToken}` } : {}),
        },
        body: JSON.stringify({
          title: article.title,
          content_html: bodyHtml,
          content_md: article.body_md,
          json_ld: article.json_ld ?? null,
        }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`webhook ${res.status}`)
      const data = await res.json().catch(() => ({}))
      publishedUrl = data.url || data.link || ''
    } catch (err) {
      console.error('[geo/publish] webhook', err)
      return NextResponse.json({ error: `Webhook 發佈失敗：${String(err)}` }, { status: 502 })
    }
    await markPublished(publishedUrl || null)
    return NextResponse.json({ mode, url: publishedUrl })
  }

  // ── 第三方平台 ──
  if ((GEO_PLATFORMS as string[]).includes(mode)) {
    const platform = mode as GeoPlatform
    const cfg = (settings?.platforms ?? {}) as GeoPlatformSettings
    const origin = new URL(req.url).origin
    const input = {
      title: article.title, bodyMd: article.body_md, bodyHtml,
      landingUrl: article.published_url && /^https?:/.test(article.published_url) ? article.published_url : `${origin}/geo/${articleId}`,
    }
    let url = ''
    try {
      if (platform === 'medium') url = await publishMedium(cfg.medium, input)
      else if (platform === 'ghost') url = await publishGhost(cfg.ghost, input)
      else if (platform === 'devto') url = await publishDevto(cfg.devto, input)
      else if (platform === 'notion') url = await publishNotion(cfg.notion, input)
      else if (platform === 'blogger') url = await publishBlogger(await getValidBloggerAccessToken(mkt.ownerId), cfg.blogger, input)
      else if (platform === 'facebook') {
        // 社群平台憑證存在公司 owner 名下
        const { data: fb } = await mkt.admin.from('social_platform_credentials')
          .select('credentials').eq('user_id', mkt.ownerId).eq('platform', 'Facebook')
          .order('updated_at', { ascending: false }).limit(1).maybeSingle()
        url = await publishFacebook((fb?.credentials ?? null) as { page_id?: string; page_access_token?: string } | null, input)
      }
    } catch (err) {
      console.error(`[geo/publish] ${platform}`, err)
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
    }
    // 第三方平台是額外曝光管道，不覆蓋文章原本的發佈網址（落地頁／WordPress）
    if (!article.published_url) await markPublished(url || null)
    return NextResponse.json({ mode: platform, url })
  }

  // ── 預設：本站 SSR 落地頁 ──
  const origin = new URL(req.url).origin
  const url = `${origin}/geo/${articleId}`
  await markPublished(url)
  return NextResponse.json({ mode: 'landing', url })
}
