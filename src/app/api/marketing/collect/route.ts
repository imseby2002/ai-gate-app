/**
 * POST /api/marketing/collect
 * 蒐集資訊單元 — 12 種蒐集管道，每種可選子項目
 *
 * Body: {
 *   types: CollectType[]
 *   subOptions: Record<string, string[]>   // per-type sub-options
 *   keywords: string
 *   location?: string        // for map search
 *   shopeeCountry?: string   // tw/vn/id/ph/my/th/sg/br/mx/co
 *   appIds?: string[]        // App Store / Google Play IDs
 *   alertRssUrls?: string[]  // Google Alerts RSS feeds
 *   limit?: number
 *   language?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const runtime = 'edge'


type CollectType =
  | 'map' | 'tiktok' | 'facebook' | 'instagram' | 'threads' | 'youtube'
  | 'amazon' | 'shopee' | 'ios_android' | 'news' | 'web' | 'competitors'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tavilySearch(query: string, limit = 6): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: limit,
      include_answer: true,
    }),
  })
  if (!res.ok) throw new Error(`Tavily error: ${res.statusText}`)
  const data = await res.json()
  const parts: string[] = []
  if (data.answer) parts.push(`📌 摘要：${data.answer}`)
  for (const item of data.results ?? []) {
    parts.push(`【${item.title}】\n${item.content}\n🔗 ${item.url}`)
  }
  return parts.join('\n\n---\n\n')
}

// ── 1. 地圖搜尋 (Outscraper) ──────────────────────────────────────────────────
async function mapSearch(
  keywords: string,
  location: string,
  subOptions: string[],
  limit: number,
): Promise<string> {
  const key = process.env.OUTSCRAPER_API_KEY
  if (!key) return '⚠️ OUTSCRAPER_API_KEY 未設定'
  const query = `${keywords} ${location}`.trim()
  const sections: string[] = []

  // Basic info + coordinates + hours via maps/search-v3
  if (subOptions.includes('info') || subOptions.includes('coordinates') || subOptions.includes('hours')) {
    try {
      const url = new URL('https://api.app.outscraper.com/maps/search-v3')
      url.searchParams.set('query', query)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('async', 'false')
      const res = await fetch(url.toString(), { headers: { 'X-API-KEY': key } })
      if (res.ok) {
        const data = await res.json()
        const places = (data.data ?? []).flat() as Array<{
          name: string; address?: string; phone?: string; website?: string
          category?: string; rating?: number; reviews?: number
          latitude?: number; longitude?: number
          working_hours?: Record<string, string>
        }>
        const lines = places.slice(0, limit).map(p => {
          const parts: string[] = [`🏢 ${p.name}`]
          if (subOptions.includes('info')) {
            if (p.address) parts.push(`📍 ${p.address}`)
            if (p.phone) parts.push(`📞 ${p.phone}`)
            if (p.website) parts.push(`🌐 ${p.website}`)
            if (p.category) parts.push(`🏷️ ${p.category}`)
            if (p.rating != null) parts.push(`⭐ ${p.rating} (${p.reviews ?? 0} 則評論)`)
          }
          if (subOptions.includes('coordinates') && p.latitude != null) {
            parts.push(`📐 ${p.latitude}, ${p.longitude}`)
          }
          if (subOptions.includes('hours') && p.working_hours) {
            const h = Object.entries(p.working_hours).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' / ')
            parts.push(`🕐 ${h}`)
          }
          return parts.join('\n')
        })
        if (lines.length) sections.push(`🗺️ 地圖組織資訊：\n\n${lines.join('\n\n---\n\n')}`)
      }
    } catch (e) {
      sections.push(`⚠️ 地圖搜尋失敗：${String(e)}`)
    }
  }

  // MAP 評論 via reviews-v3
  if (subOptions.includes('reviews')) {
    try {
      const url = new URL('https://api.app.outscraper.com/maps/reviews-v3')
      url.searchParams.set('query', query)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('sort', 'newest')
      url.searchParams.set('async', 'false')
      const res = await fetch(url.toString(), { headers: { 'X-API-KEY': key } })
      if (res.ok) {
        const data = await res.json()
        const reviews = (data.data ?? []).flat() as Array<{
          author_title?: string; review_text?: string; review_rating?: number; owner_answer?: string
        }>
        const lines = reviews.filter(r => r.review_text).slice(0, limit).map(r =>
          `⭐ ${r.review_rating ?? '-'} — ${r.author_title ?? '匿名'}\n「${r.review_text?.slice(0, 300) ?? ''}」`
        )
        if (lines.length) sections.push(`📝 MAP 評論：\n\n${lines.join('\n\n---\n\n')}`)
      }
    } catch (e) {
      sections.push(`⚠️ MAP 評論取得失敗：${String(e)}`)
    }
  }

  return sections.join('\n\n') || '⚠️ 無地圖資料'
}

// ── 2-5. 社群平台 TikTok / Facebook / Instagram / Threads (Tavily) ────────────
async function socialSearch(
  platform: 'tiktok' | 'facebook' | 'instagram' | 'threads',
  keywords: string,
  subOptions: string[],
  limit: number,
): Promise<string> {
  const cfg: Record<string, { name: string; emoji: string; site: string }> = {
    tiktok:    { name: 'TikTok',    emoji: '📱', site: 'tiktok.com' },
    facebook:  { name: 'Facebook',  emoji: '👥', site: 'facebook.com' },
    instagram: { name: 'Instagram', emoji: '📸', site: 'instagram.com' },
    threads:   { name: 'Threads',   emoji: '🧵', site: 'threads.net' },
  }
  const p = cfg[platform]
  const parts: string[] = []
  const perQ = Math.max(3, Math.ceil(limit / Math.max(subOptions.length, 1)))

  for (const sub of subOptions) {
    const isComment = sub === 'comments'
    const query = isComment
      ? `site:${p.site} ${keywords} review comment 評論`
      : `site:${p.site} ${keywords}`
    const label = isComment ? '評論' : (platform === 'tiktok' ? '影音' : '內文')
    try {
      const result = await tavilySearch(query, perQ)
      parts.push(`${p.emoji} ${p.name} ${label}：\n${result}`)
    } catch { /* skip */ }
  }
  return parts.join('\n\n')
}

// ── 6. YouTube ────────────────────────────────────────────────────────────────
async function youtubeSearch(keywords: string, subOptions: string[], limit: number): Promise<string> {
  const parts: string[] = []
  const apiKey = process.env.YOUTUBE_API_KEY
  const perQ = Math.max(3, Math.ceil(limit / Math.max(subOptions.length, 1)))

  for (const sub of subOptions) {
    if (sub === 'comments') {
      const result = await tavilySearch(`site:youtube.com ${keywords} review comment`, perQ)
      parts.push(`🎬 YouTube 評論：\n${result}`)
      continue
    }
    const isShort = sub === 'shorts'
    const label = isShort ? 'YouTube Shorts' : 'YouTube 長影片'

    if (apiKey) {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search')
        url.searchParams.set('q', keywords)
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('type', 'video')
        url.searchParams.set('maxResults', String(perQ))
        url.searchParams.set('videoDuration', isShort ? 'short' : 'long')
        url.searchParams.set('order', 'viewCount')
        url.searchParams.set('key', apiKey)
        const res = await fetch(url.toString())
        if (res.ok) {
          const data = await res.json()
          const items = (data.items ?? []) as Array<{
            id: { videoId: string }
            snippet: { title: string; description: string; channelTitle: string }
          }>
          if (items.length > 0) {
            const lines = items.map(v =>
              `【${v.snippet.title}】\n頻道：${v.snippet.channelTitle}\n${v.snippet.description?.slice(0, 150) ?? ''}\n🔗 https://youtube.com/watch?v=${v.id.videoId}`
            )
            parts.push(`🎬 ${label}：\n\n${lines.join('\n\n---\n\n')}`)
            continue
          }
        }
      } catch { /* fallback */ }
    }
    // Fallback Tavily
    const q = isShort ? `YouTube Shorts ${keywords} viral` : `YouTube ${keywords} 影片`
    const result = await tavilySearch(q, perQ)
    parts.push(`🎬 ${label}：\n${result}`)
  }
  return parts.join('\n\n')
}

// ── 7. Amazon ─────────────────────────────────────────────────────────────────
async function amazonSearch(keywords: string, subOptions: string[], limit: number): Promise<string> {
  const parts: string[] = []
  const perQ = Math.max(3, Math.ceil(limit / Math.max(subOptions.length, 1)))
  for (const sub of subOptions) {
    const q = sub === 'reviews'
      ? `site:amazon.com ${keywords} customer review stars`
      : `site:amazon.com ${keywords} product`
    const label = sub === 'reviews' ? '評論' : '產品'
    const result = await tavilySearch(q, perQ)
    parts.push(`📦 Amazon ${label}：\n${result}`)
  }
  return parts.join('\n\n')
}

// ── 8. Shopee ─────────────────────────────────────────────────────────────────
const SHOPEE_DOMAINS: Record<string, string> = {
  tw: 'shopee.tw',
  vn: 'shopee.vn',
  id: 'shopee.co.id',
  ph: 'shopee.ph',
  my: 'shopee.com.my',
  th: 'shopee.co.th',
  sg: 'shopee.sg',
  br: 'shopee.com.br',
  mx: 'shopee.com.mx',
  co: 'shopee.com.co',
}

async function shopeeSearch(
  keywords: string,
  country: string,
  subOptions: string[],
  limit: number,
): Promise<string> {
  const domain = SHOPEE_DOMAINS[country] ?? 'shopee.tw'
  const parts: string[] = []
  const perQ = Math.max(3, Math.ceil(limit / Math.max(subOptions.length, 1)))
  for (const sub of subOptions) {
    const q = sub === 'reviews'
      ? `site:${domain} ${keywords} 評價 review`
      : `site:${domain} ${keywords} 產品`
    const label = sub === 'reviews' ? '評論' : '產品'
    const result = await tavilySearch(q, perQ)
    parts.push(`🛒 Shopee (${domain}) ${label}：\n${result}`)
  }
  return parts.join('\n\n')
}

// ── 9. iOS / Android ──────────────────────────────────────────────────────────
async function appReviews(appIds: string[], keywords: string, limit: number): Promise<string> {
  const parts: string[] = []

  // App Store (iTunes RSS, free)
  for (const appId of appIds.slice(0, 3)) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/rss/customerreviews/page=1/id=${appId.trim()}/sortby=mostrecent/json`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      )
      if (!res.ok) continue
      const data = await res.json()
      const appName = data?.feed?.['im:name']?.label ?? appId
      const entries = (data?.feed?.entry ?? []).slice(0, limit) as Array<{
        title: { label: string }; content: { label: string }
        'im:rating': { label: string }; author: { name: { label: string } }
      }>
      if (entries.length > 0) {
        const lines = entries.map(e =>
          `⭐ ${e['im:rating']?.label ?? '-'} — ${e.author?.name?.label ?? '匿名'}\n「${e.content?.label?.slice(0, 300) ?? ''}」`
        )
        parts.push(`📱 ${appName} (App Store)：\n\n${lines.join('\n\n---\n\n')}`)
      }
    } catch { /* skip */ }
  }

  // Google Play via Tavily
  try {
    const q = appIds.length > 0
      ? `site:play.google.com ${keywords} review rating`
      : `Google Play ${keywords} app review`
    const result = await tavilySearch(q, Math.ceil(limit / 2))
    parts.push(`🤖 Google Play 評論：\n${result}`)
  } catch { /* skip */ }

  return parts.join('\n\n') || '⚠️ 無 App 評論資料'
}

// ── 10. Google Alerts RSS ─────────────────────────────────────────────────────
async function googleAlertsRss(rssUrls: string[]): Promise<string> {
  if (!rssUrls || rssUrls.length === 0) return '⚠️ 未提供 Google Alerts RSS URL。'
  const results: string[] = []
  for (const url of rssUrls.slice(0, 5)) {
    try {
      const res = await fetch(url.trim(), { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) { results.push(`⚠️ 無法取得 ${url}`); continue }
      const xml = await res.text()
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      const parsed = entries.slice(0, 10).map(m => {
        const title   = m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? ''
        const link    = m[1].match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ''
        const summary = m[1].match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]?.replace(/<[^>]+>/g, '').slice(0, 200).trim() ?? ''
        const updated = m[1].match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() ?? ''
        return `🔔 ${title}\n${summary}\n🔗 ${link}\n📅 ${updated}`
      })
      results.push(...parsed)
    } catch (e) {
      results.push(`⚠️ RSS 解析失敗 (${url})：${String(e)}`)
    }
  }
  return results.join('\n\n---\n\n') || '無 Alerts 資料'
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const {
    types = ['web'],
    subOptions = {} as Record<string, string[]>,
    keywords,
    location = '',
    shopeeCountry = 'tw',
    appIds = [] as string[],
    alertRssUrls = [] as string[],
    limit = 10,
    language = 'zh-TW',
    topic,
    industry,
  } = await req.json()

  const kw = keywords || topic || ''
  if (!kw) return NextResponse.json({ error: 'keywords required' }, { status: 400 })

  const selectedTypes: CollectType[] = types

  // getSub: return user-selected sub-options, or all defaults if none specified
  const getSub = (type: string, defaults: string[]): string[] =>
    (subOptions[type] ?? []).length > 0 ? (subOptions[type] as string[]) : defaults

  const tasks: Promise<[string, string]>[] = []

  if (selectedTypes.includes('map')) {
    const sub = getSub('map', ['info', 'reviews'])
    tasks.push(mapSearch(kw, location, sub, limit).then(r => ['🗺️ 地圖搜尋', r]))
  }
  if (selectedTypes.includes('tiktok')) {
    const sub = getSub('tiktok', ['videos', 'comments'])
    tasks.push(socialSearch('tiktok', kw, sub, limit).then(r => ['📱 TikTok', r]))
  }
  if (selectedTypes.includes('facebook')) {
    const sub = getSub('facebook', ['posts', 'comments'])
    tasks.push(socialSearch('facebook', kw, sub, limit).then(r => ['👥 Facebook', r]))
  }
  if (selectedTypes.includes('instagram')) {
    const sub = getSub('instagram', ['posts', 'comments'])
    tasks.push(socialSearch('instagram', kw, sub, limit).then(r => ['📸 Instagram', r]))
  }
  if (selectedTypes.includes('threads')) {
    const sub = getSub('threads', ['posts', 'comments'])
    tasks.push(socialSearch('threads', kw, sub, limit).then(r => ['🧵 Threads', r]))
  }
  if (selectedTypes.includes('youtube')) {
    const sub = getSub('youtube', ['videos', 'comments'])
    tasks.push(youtubeSearch(kw, sub, limit).then(r => ['🎬 YouTube', r]))
  }
  if (selectedTypes.includes('amazon')) {
    const sub = getSub('amazon', ['products', 'reviews'])
    tasks.push(amazonSearch(kw, sub, limit).then(r => ['📦 Amazon', r]))
  }
  if (selectedTypes.includes('shopee')) {
    const sub = getSub('shopee', ['products', 'reviews'])
    tasks.push(shopeeSearch(kw, shopeeCountry, sub, limit).then(r => ['🛒 Shopee', r]))
  }
  if (selectedTypes.includes('ios_android')) {
    tasks.push(appReviews(appIds, kw, limit).then(r => ['📱 iOS/Android', r]))
  }
  if (selectedTypes.includes('news')) {
    tasks.push(googleAlertsRss(alertRssUrls).then(r => ['🔔 新聞 (Google Alerts)', r]))
  }
  if (selectedTypes.includes('web')) {
    const q = industry ? `${kw} ${industry} 市場趨勢` : `${kw} 市場趨勢`
    tasks.push(tavilySearch(q, limit).then(r => ['🌐 網頁搜尋', r]))
  }
  if (selectedTypes.includes('competitors')) {
    const q = industry ? `${kw} ${industry} 競爭對手 競品` : `${kw} 競爭對手 競品分析`
    tasks.push(tavilySearch(q, limit).then(r => ['🎯 競爭對手', r]))
  }

  const results = await Promise.allSettled(tasks)
  const sections: string[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [label, content] = r.value
      sections.push(`═══ ${label} ═══\n\n${content}`)
    }
  }

  if (sections.length === 0) {
    return NextResponse.json({ error: '所有資料來源均無回傳，請確認 API 金鑰設定' }, { status: 503 })
  }

  const rawContent = sections.join('\n\n\n')

  // ── DeepSeek 整理摘要 ─────────────────────────────────────────────────────────
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })

  const { text: summary } = await generateText({
    model: deepseek.chat('deepseek-chat'),
    messages: [{
      role: 'system',
      content: '你是一位市場調查分析師，擅長從多元來源資料中提煉行銷洞察，以繁體中文輸出清晰結構化報告。',
    }, {
      role: 'user',
      content: `請根據以下蒐集到的資料，整理成完整的行銷情報摘要：

關鍵字：${kw}
地區：${location || '未指定'}
蒐集類型：${selectedTypes.join('、')}

原始資料：
${rawContent.slice(0, 12000)}

請整理成結構化格式（條列式），包含：
【市場概況】
• ...

【競品動態】（如有）
• ...

【各平台內容分析】（如有社群/電商資料）
• ...

【消費者評價摘要】（如有評論資料）
• ...

【熱門關鍵字與話題】
• ...

【行銷洞察與建議】
• ...`,
    }],
    maxOutputTokens: 3000,
  })

  return NextResponse.json({
    summary,
    raw: rawContent,
    types: selectedTypes,
    keywords: kw,
    location,
  })
}
