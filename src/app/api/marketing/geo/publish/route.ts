/**
 * POST /api/marketing/geo/publish
 * GEO Writer 步驟6 — 發佈
 *  - mode='landing'：標記已發佈，published_url 指向本站 SSR 落地頁 /geo/<id>
 *  - mode='wordpress'：POST 文章到 GEO_WORDPRESS_WEBHOOK（含 html/md/json_ld），回傳連結
 *
 * Body: { articleId: string; mode?: 'landing' | 'wordpress' }
 * Resp: { url: string; mode }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mdToHtml } from '@/lib/geo/md'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, mode = 'landing' } = await req.json()
  if (!articleId) return NextResponse.json({ error: '缺少 articleId' }, { status: 400 })

  // RLS 確保擁有者
  const { data: article } = await supabase
    .from('geo_articles')
    .select('id, title, body_md, json_ld')
    .eq('id', articleId)
    .single()
  if (!article) return NextResponse.json({ error: '找不到文章' }, { status: 404 })

  if (mode === 'wordpress') {
    const hook = process.env.GEO_WORDPRESS_WEBHOOK
    if (!hook) return NextResponse.json({ error: 'GEO_WORDPRESS_WEBHOOK 未設定' }, { status: 400 })
    let publishedUrl = ''
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.GEO_WORDPRESS_TOKEN ? { Authorization: `Bearer ${process.env.GEO_WORDPRESS_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          title: article.title,
          content_html: mdToHtml(article.body_md),
          content_md: article.body_md,
          json_ld: article.json_ld ?? null,
        }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`webhook ${res.status}`)
      const data = await res.json().catch(() => ({}))
      publishedUrl = data.url || data.link || ''
    } catch (err) {
      console.error('[geo/publish] wordpress', err)
      return NextResponse.json({ error: `WordPress 發佈失敗：${String(err)}` }, { status: 502 })
    }

    await supabase.from('geo_articles')
      .update({ status: 'published', published_url: publishedUrl || null })
      .eq('id', articleId)
    return NextResponse.json({ url: publishedUrl, mode })
  }

  // landing
  const origin = new URL(req.url).origin
  const url = `${origin}/geo/${articleId}`
  await supabase.from('geo_articles')
    .update({ status: 'published', published_url: url })
    .eq('id', articleId)
  return NextResponse.json({ url, mode })
}
