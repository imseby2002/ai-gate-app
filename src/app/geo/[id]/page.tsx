/**
 * GEO 公開落地頁（SSR）— /geo/[id]
 * 放行 AI 爬蟲 + 伺服器端渲染完整 HTML，並注入 JSON-LD，最大化被 AI 引擎引用機率。
 * 僅顯示 status='published' 的文章。
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { mdToHtml } from '@/lib/geo/md'

export const dynamic = 'force-dynamic'

async function getArticle(id: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('geo_articles')
    .select('id, title, body_md, json_ld, status')
    .eq('id', id)
    .eq('status', 'published')
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) return { title: 'Not found', robots: { index: false } }
  const desc = article.body_md.replace(/[#*`|>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 155)
  return {
    title: article.title,
    description: desc,
    robots: { index: true, follow: true },
  }
}

export default async function GeoLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) notFound()

  const bodyHtml = mdToHtml(article.body_md)
  const jsonLd = article.json_ld
    ? (typeof article.json_ld === 'string' ? article.json_ld : JSON.stringify(article.json_ld))
    : null

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', lineHeight: 1.7 }}>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      <article
        className="geo-article"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <style>{`
        .geo-article h1 { font-size: 1.9rem; font-weight: 800; margin: 0 0 1rem; }
        .geo-article h2 { font-size: 1.4rem; font-weight: 700; margin: 2rem 0 .75rem; }
        .geo-article h3 { font-size: 1.15rem; font-weight: 700; margin: 1.5rem 0 .5rem; }
        .geo-article p { margin: .75rem 0; }
        .geo-article ul, .geo-article ol { margin: .75rem 0 .75rem 1.5rem; }
        .geo-article li { margin: .35rem 0; }
        .geo-article a { color: #4f46e5; text-decoration: underline; }
        .geo-article table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .95rem; }
        .geo-article th, .geo-article td { border: 1px solid #e2e8f0; padding: .5rem .75rem; text-align: left; }
        .geo-article th { background: #f8fafc; font-weight: 700; }
      `}</style>
    </main>
  )
}
