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
 * Body: { articleId: string; mode?: 'landing'|'wordpress'|'webhook'|'export' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mdToHtml, buildStandaloneHtml } from '@/lib/geo/md'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, mode = 'landing' } = await req.json()
  if (!articleId) return NextResponse.json({ error: '缺少 articleId' }, { status: 400 })

  const { data: article } = await supabase
    .from('geo_articles')
    .select('id, title, body_md, json_ld')
    .eq('id', articleId)
    .single()
  if (!article) return NextResponse.json({ error: '找不到文章' }, { status: 404 })

  // 每位使用者自己的發佈設定（優先），未設則退回 env
  const { data: settings } = await supabase
    .from('geo_publish_settings')
    .select('wp_base_url, wp_user, wp_app_password, webhook_url, webhook_token')
    .eq('user_id', user.id)
    .single()

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
      ? `${bodyHtml}\n<script type="application/ld+json">${jsonLdStr}</script>`
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
      const res = await fetch(hook, {
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

  // ── 預設：本站 SSR 落地頁 ──
  const origin = new URL(req.url).origin
  const url = `${origin}/geo/${articleId}`
  await markPublished(url)
  return NextResponse.json({ mode: 'landing', url })
}
