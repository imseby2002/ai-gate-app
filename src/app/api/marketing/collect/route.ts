/**
 * POST /api/marketing/collect
 * 蒐集資訊單元 — 支援多種資料來源並行蒐集，最後 DeepSeek 整理摘要
 *
 * types:
 *   原有：news | web | maps | reviews | company | competitors
 *   新增：google_alerts | platform_reviews | videos_long | videos_short | sales_data
 *
 * Body: {
 *   types: CollectType[]
 *   keywords: string
 *   location?: string
 *   radius?: string
 *   limit?: number
 *   language?: string
 *   // 新增欄位
 *   alertRssUrls?: string[]   // Google Alerts RSS URLs
 *   appIds?: string[]         // App Store / Google Play App IDs
 *   shopUrls?: string[]       // Shopee / Lazada / Amazon 商品頁 URL
 *   salesData?: string        // 手動貼入的銷售資料（CSV 或文字）
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const maxDuration = 120

type CollectType =
  | 'news' | 'web' | 'maps' | 'reviews' | 'company' | 'competitors'
  | 'google_alerts' | 'platform_reviews' | 'videos_long' | 'videos_short' | 'sales_data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ── Tavily (web / competitors / fallback search) ──────────────────────────────
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

// ── Apify Google News ─────────────────────────────────────────────────────────
async function apifyNews(keywords: string, limit: number, language: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) return '⚠️ APIFY_API_TOKEN 未設定，跳過新聞蒐集。'
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-news-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: [keywords], maxItems: limit, language: language.startsWith('zh') ? 'zh-TW' : 'en' }),
      }
    )
    if (!res.ok) throw new Error(res.statusText)
    const items = await res.json()
    return (items as Array<{ title: string; url: string; body?: string }>)
      .slice(0, limit)
      .map((item) => `📰 ${item.title}\n${item.body?.slice(0, 300) ?? ''}\n🔗 ${item.url}`)
      .join('\n\n---\n\n')
  } catch (e) {
    return `⚠️ Apify 新聞蒐集失敗：${String(e)}`
  }
}

// ── Google Alerts RSS ─────────────────────────────────────────────────────────
async function googleAlertsRss(rssUrls: string[]): Promise<string> {
  if (!rssUrls || rssUrls.length === 0) return '⚠️ 未提供 Google Alerts RSS URL。'
  const results: string[] = []
  for (const url of rssUrls.slice(0, 5)) {
    try {
      const res = await fetch(url.trim(), { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) { results.push(`⚠️ 無法取得 ${url}`); continue }
      const xml = await res.text()
      // Parse Atom feed entries
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      const parsed = entries.slice(0, 10).map(m => {
        const title = m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? ''
        const link  = m[1].match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ''
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

// ── App Store Reviews (iTunes API — free, no key) ─────────────────────────────
async function appStoreReviews(appIds: string[], limit: number): Promise<string> {
  if (!appIds || appIds.length === 0) return '⚠️ 未提供 App ID。'
  const results: string[] = []
  for (const appId of appIds.slice(0, 3)) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/rss/customerreviews/page=1/id=${appId.trim()}/sortby=mostrecent/json`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      const entries = (data?.feed?.entry ?? []).slice(0, limit) as Array<{
        title: { label: string }; content: { label: string }; 'im:rating': { label: string }; author: { name: { label: string } }
      }>
      if (entries.length === 0) { results.push(`App ${appId}：無評論資料`); continue }
      const appName = data?.feed?.['im:name']?.label ?? appId
      results.push(`📱 ${appName} App Store 評論：`)
      entries.forEach(e => {
        results.push(`⭐ ${e['im:rating']?.label ?? '-'} — ${e.author?.name?.label ?? '匿名'}\n「${e.content?.label?.slice(0, 300) ?? ''}」`)
      })
    } catch (e) {
      results.push(`⚠️ App Store 評論失敗 (${appId})：${String(e)}`)
    }
  }
  return results.join('\n\n---\n\n')
}

// ── Shopee / Amazon / Platform Reviews (via Tavily) ───────────────────────────
async function platformReviews(keywords: string, shopUrls: string[], limit: number): Promise<string> {
  const parts: string[] = []
  // Search for reviews on major e-commerce platforms
  const platforms = ['shopee', 'lazada', 'amazon', 'momo', 'pcstore']
  for (const platform of platforms.slice(0, 3)) {
    try {
      const query = `site:${platform}.com ${keywords} review rating`
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: Math.ceil(limit / 3), search_depth: 'basic' }),
      })
      if (!res.ok) continue
      const data = await res.json()
      const items = (data.results ?? []) as Array<{ title: string; content: string; url: string }>
      if (items.length === 0) continue
      parts.push(`🛒 ${platform.toUpperCase()} 相關評論：`)
      items.forEach(item => parts.push(`• ${item.title}\n  ${item.content?.slice(0, 200)}\n  🔗 ${item.url}`))
    } catch (_) {}
  }
  // Also fetch specific shop URLs if provided
  for (const url of (shopUrls ?? []).slice(0, 3)) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: url, max_results: 3, search_depth: 'basic' }),
      })
      if (!res.ok) continue
      const data = await res.json()
      const items = (data.results ?? []) as Array<{ title: string; content: string }>
      items.forEach(item => parts.push(`🔗 ${url}\n• ${item.content?.slice(0, 300)}`))
    } catch (_) {}
  }
  return parts.join('\n\n---\n\n') || '⚠️ 平台評論蒐集失敗，請確認 TAVILY_API_KEY'
}

// ── YouTube (long-form videos) ────────────────────────────────────────────────
async function youtubeVideos(keywords: string, limit: number, isShort: boolean): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey) {
    try {
      const duration = isShort ? 'short' : 'long'
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('q', keywords)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('type', 'video')
      url.searchParams.set('maxResults', String(limit))
      url.searchParams.set('videoDuration', duration)
      url.searchParams.set('order', 'viewCount')
      url.searchParams.set('key', apiKey)
      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        const items = (data.items ?? []) as Array<{
          id: { videoId: string }
          snippet: { title: string; description: string; channelTitle: string; publishedAt: string }
        }>
        if (items.length > 0) {
          const label = isShort ? 'YouTube Shorts / 短影片' : 'YouTube 長影片'
          return `🎬 ${label}：\n\n` + items.map(v =>
            `【${v.snippet.title}】\n頻道：${v.snippet.channelTitle}\n${v.snippet.description?.slice(0, 200) ?? ''}\n🔗 https://youtube.com/watch?v=${v.id.videoId}`
          ).join('\n\n---\n\n')
        }
      }
    } catch (_) {}
  }
  // Fallback: Tavily search
  const platformLabel = isShort ? 'TikTok OR YouTube Shorts OR Instagram Reels' : 'YouTube'
  const query = `${platformLabel} ${keywords} ${isShort ? '短影片 viral' : '影片 channel'}`
  return await tavilySearch(query, limit)
}

// ── Outscraper Google Maps ────────────────────────────────────────────────────
async function outscraperMaps(keywords: string, location: string, radiusKm: string, limit: number): Promise<string> {
  const key = process.env.OUTSCRAPER_API_KEY
  if (!key) return '⚠️ OUTSCRAPER_API_KEY 未設定，跳過地圖蒐集。'
  const query = `${keywords} ${location}`.trim()
  try {
    const url = new URL('https://api.app.outscraper.com/maps/search-v3')
    url.searchParams.set('query', query)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('radius', String(Number(radiusKm) * 1000))
    url.searchParams.set('async', 'false')
    const res = await fetch(url.toString(), { headers: { 'X-API-KEY': key } })
    if (!res.ok) throw new Error(res.statusText)
    const data = await res.json()
    const places = (data.data ?? []).flat()
    return (places as Array<{ name: string; address?: string; rating?: number; reviews?: number; phone?: string; website?: string; category?: string }>)
      .slice(0, limit)
      .map(p => `🏢 ${p.name}\n📍 ${p.address ?? ''}\n⭐ ${p.rating ?? '-'} (${p.reviews ?? 0} 則評論)\n📞 ${p.phone ?? '-'}\n🌐 ${p.website ?? '-'}\n🏷️ ${p.category ?? ''}`)
      .join('\n\n---\n\n')
  } catch (e) {
    return `⚠️ Outscraper 地圖蒐集失敗：${String(e)}`
  }
}

// ── Outscraper Reviews ────────────────────────────────────────────────────────
async function outscraperReviews(keywords: string, location: string, limit: number): Promise<string> {
  const key = process.env.OUTSCRAPER_API_KEY
  if (!key) return '⚠️ OUTSCRAPER_API_KEY 未設定，跳過評論蒐集。'
  const query = `${keywords} ${location}`.trim()
  try {
    const url = new URL('https://api.app.outscraper.com/maps/reviews-v3')
    url.searchParams.set('query', query)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('sort', 'newest')
    url.searchParams.set('async', 'false')
    const res = await fetch(url.toString(), { headers: { 'X-API-KEY': key } })
    if (!res.ok) throw new Error(res.statusText)
    const data = await res.json()
    const reviews = (data.data ?? []).flat()
    return (reviews as Array<{ author_title?: string; review_text?: string; review_rating?: number; owner_answer?: string }>)
      .slice(0, limit)
      .filter(r => r.review_text)
      .map(r => `⭐ ${r.review_rating ?? '-'} — ${r.author_title ?? '匿名'}\n「${r.review_text?.slice(0, 400) ?? ''}」${r.owner_answer ? `\n🔁 回覆：${r.owner_answer.slice(0, 200)}` : ''}`)
      .join('\n\n---\n\n')
  } catch (e) {
    return `⚠️ Outscraper 評論蒐集失敗：${String(e)}`
  }
}

// ── Sales Data ────────────────────────────────────────────────────────────────
async function collectSalesData(keywords: string, salesData: string): Promise<string> {
  if (salesData?.trim()) {
    return `📊 手動輸入銷售資料：\n\n${salesData.slice(0, 5000)}`
  }
  // Search for market sales data via Tavily
  const query = `${keywords} 銷售數據 市場佔有率 銷量 revenue`
  return await tavilySearch(query, 5)
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const {
    types = ['web'],
    keywords,
    location = '',
    radius = '5',
    limit = 10,
    language = 'zh-TW',
    topic,
    industry,
    // New fields
    alertRssUrls = [],
    appIds = [],
    shopUrls = [],
    salesData = '',
  } = await req.json()

  const kw = keywords || topic || ''
  if (!kw) return NextResponse.json({ error: 'keywords required' }, { status: 400 })

  const selectedTypes: CollectType[] = types
  const tasks: Promise<[string, string]>[] = []

  // ── Original types ───────────────────────────────────────────────────────
  if (selectedTypes.includes('news')) {
    tasks.push(apifyNews(kw, limit, language).then(r => ['📰 新聞', r]))
  }
  if (selectedTypes.includes('web')) {
    const query = industry ? `${kw} ${industry} 市場趨勢` : `${kw} 市場趨勢`
    tasks.push(tavilySearch(query, limit).then(r => ['🌐 網頁搜尋', r]))
  }
  if (selectedTypes.includes('maps')) {
    tasks.push(outscraperMaps(kw, location, radius, limit).then(r => ['🗺️ Google 地圖', r]))
  }
  if (selectedTypes.includes('reviews')) {
    tasks.push(outscraperReviews(kw, location, limit).then(r => ['⭐ Google 評論', r]))
  }
  if (selectedTypes.includes('company')) {
    tasks.push(outscraperMaps(`${kw} 公司`, location, radius, limit).then(r => ['🏢 公司資料', r]))
  }
  if (selectedTypes.includes('competitors')) {
    const query = industry ? `${kw} ${industry} 競爭對手 競品` : `${kw} 競爭對手 競品分析`
    tasks.push(tavilySearch(query, limit).then(r => ['🎯 競爭對手', r]))
  }

  // ── New types ────────────────────────────────────────────────────────────
  if (selectedTypes.includes('google_alerts')) {
    tasks.push(googleAlertsRss(alertRssUrls).then(r => ['🔔 Google 快訊', r]))
  }
  if (selectedTypes.includes('platform_reviews')) {
    const appTask   = appIds.length > 0 ? appStoreReviews(appIds, Math.ceil(limit / 2)) : Promise.resolve('（未提供 App ID）')
    const shopTask  = platformReviews(kw, shopUrls, limit)
    tasks.push(Promise.all([appTask, shopTask]).then(([a, b]) => ['🛒 平台評論', [a, b].join('\n\n')]))
  }
  if (selectedTypes.includes('videos_long')) {
    tasks.push(youtubeVideos(kw, limit, false).then(r => ['🎬 長影片', r]))
  }
  if (selectedTypes.includes('videos_short')) {
    tasks.push(youtubeVideos(kw, limit, true).then(r => ['📱 短影片', r]))
  }
  if (selectedTypes.includes('sales_data')) {
    tasks.push(collectSalesData(kw, salesData).then(r => ['📊 銷售資料', r]))
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

  // ── DeepSeek 整理摘要 ─────────────────────────────────────────────────────
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })

  const hasVideo    = selectedTypes.includes('videos_long') || selectedTypes.includes('videos_short')
  const hasSales    = selectedTypes.includes('sales_data')
  const hasAlerts   = selectedTypes.includes('google_alerts')
  const hasPlatform = selectedTypes.includes('platform_reviews')

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

請整理成以下格式（有哪些就呈現哪些，條列式）：

【市場概況】
• ...

【競品動態】（如有蒐集）
• ...

${hasAlerts ? '【Google 快訊摘要】\n• ...\n\n' : ''}${hasPlatform ? '【各平台評論分析】\n• ...\n\n' : ''}${hasVideo ? '【熱門影片趨勢】\n• ...\n\n' : ''}${hasSales ? '【銷售數據摘要】\n• ...\n\n' : ''}【消費者評價摘要】（如有評論）
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
