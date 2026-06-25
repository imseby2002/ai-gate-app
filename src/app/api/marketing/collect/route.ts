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

type CollectType =
  | 'map' | 'tiktok' | 'facebook' | 'instagram' | 'threads' | 'youtube'
  | 'amazon' | 'shopee' | 'ios_android' | 'news' | 'web' | 'competitors' | 'trend' | 'dcard' | 'booking'

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

/** 將關鍵字字串拆成多個關鍵字（逗號 / 換行分隔） */
function splitKeywords(keywords: string): string[] {
  return keywords
    .split(/[,\n;]+/)
    .map(k => k.trim())
    .filter(Boolean)
}

async function mapSearch(
  keywords: string,
  location: string,
  subOptions: string[],
  limit: number,
): Promise<string> {
  const key = process.env.OUTSCRAPER_API_KEY
  if (!key) return '⚠️ OUTSCRAPER_API_KEY 未設定'

  // 拆成多個關鍵字，各自查詢後合併（去重）
  const kwList = splitKeywords(keywords)
  const allPlaces: Array<{
    name: string; address?: string
    phone?: string; phone_1?: string; phone_2?: string
    international_phone_format?: string; phone_number?: string
    full_address?: string
    website?: string; site?: string
    category?: string; type?: string
    rating?: number; reviews?: number; reviews_count?: number
    latitude?: number; longitude?: number
    working_hours?: Record<string, string>
    [key: string]: unknown
  }> = []
  const seen = new Set<string>()

  const sections: string[] = []

  // Basic info + coordinates + hours via maps/search-v3
  if (subOptions.includes('info') || subOptions.includes('coordinates') || subOptions.includes('hours')) {
    for (const kw of kwList) {
      const query = `${kw} ${location}`.trim()
      try {
        const url = new URL('https://api.app.outscraper.com/maps/search-v3')
        url.searchParams.set('query', query)
        url.searchParams.set('limit', String(Math.min(limit, 100)))
        url.searchParams.set('async', 'false')
        const res = await fetch(url.toString(), { headers: { 'X-API-KEY': key } })
        if (res.ok) {
          const data = await res.json()
          const places = (data.data ?? []).flat() as typeof allPlaces
          // DEBUG: log first result's keys to identify actual field names
          if (places.length > 0 && allPlaces.length === 0) {
            console.log('[Outscraper debug] first place keys:', Object.keys(places[0]))
            console.log('[Outscraper debug] phone fields:', {
              phone: places[0].phone, phone_1: places[0].phone_1, phone_2: places[0].phone_2,
              international_phone_format: places[0].international_phone_format,
              phone_number: places[0].phone_number,
              name: places[0].name,
            })
          }
          for (const p of places) {
            const key2 = `${p.name}|${p.address ?? p.full_address ?? ''}`
            if (!seen.has(key2)) {
              seen.add(key2)
              allPlaces.push(p)
            }
          }
        }
      } catch (e) {
        sections.push(`⚠️ 地圖搜尋「${kw}」失敗：${String(e)}`)
      }
    }

    // ── Per-org email discovery via Tavily ────────────────────────────────────
    const emailRegex = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g
    const orgEmailMap: Record<string, string> = {}
    const placesToSearch = allPlaces.slice(0, Math.min(limit, 30))
    // 批次搜尋，最多 10 家（避免 API 過多）
    for (const p of placesToSearch.slice(0, 10)) {
      try {
        const website = p.website || p.site
        const q = website
          ? `"${p.name}" email contact ${website}`
          : `"${p.name}" ${location} email contact`
        const result = await tavilySearch(q, 3)
        const emails = result.match(emailRegex)
        const valid = emails?.find(e =>
          !e.includes('example') && !e.includes('noreply') &&
          !e.includes('sentry') && !e.includes('wix') && e.length < 60
        )
        if (valid) orgEmailMap[p.name] = valid
      } catch { /* skip */ }
    }

    const lines = allPlaces.slice(0, limit).map(p => {
      const phone = p.phone || p.phone_1 || p.phone_2 || p.international_phone_format || p.phone_number
      const address = p.address || p.full_address
      const website = p.website || p.site
      const category = p.category || p.type
      const reviewCount = p.reviews ?? p.reviews_count
      const email = orgEmailMap[p.name]
      const lineParts: string[] = [`🏢 ${p.name}`]
      if (subOptions.includes('info')) {
        if (address)  lineParts.push(`📍 ${address}`)
        if (phone)    lineParts.push(`📞 ${phone}`)
        if (email)    lineParts.push(`📧 ${email}`)
        if (website)  lineParts.push(`🌐 ${website}`)
        if (category) lineParts.push(`🏷️ ${category}`)
        if (p.rating != null) lineParts.push(`⭐ ${p.rating} (${reviewCount ?? 0} 則評論)`)
      }
      if (subOptions.includes('coordinates') && p.latitude != null) {
        lineParts.push(`📐 ${p.latitude}, ${p.longitude}`)
      }
      if (subOptions.includes('hours') && p.working_hours) {
        const h = Object.entries(p.working_hours).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' / ')
        lineParts.push(`🕐 ${h}`)
      }
      return lineParts.join('\n')
    })
    if (lines.length) sections.push(`🗺️ 地圖組織資訊（共 ${lines.length} 筆）：\n\n${lines.join('\n\n---\n\n')}`)
  }

  // MAP 評論 via reviews-v3
  if (subOptions.includes('reviews')) {
    for (const kw of kwList) {
      const query = `${kw} ${location}`.trim()
      try {
        const url = new URL('https://api.app.outscraper.com/maps/reviews-v3')
        url.searchParams.set('query', query)
        url.searchParams.set('limit', String(Math.min(limit, 100)))
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
          if (lines.length) sections.push(`📝 MAP 評論（${kw}）：\n\n${lines.join('\n\n---\n\n')}`)
        }
      } catch (e) {
        sections.push(`⚠️ MAP 評論「${kw}」失敗：${String(e)}`)
      }
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
    if (sub === 'vendor_info') {
      try {
        const query = `${keywords} ${p.name} 廠商 品牌 聯絡 電話 email 官網`
        const result = await tavilySearch(query, perQ)
        parts.push(`${p.emoji} ${p.name} 廠商資料：\n${result}`)
      } catch { /* skip */ }
      continue
    }
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
    if (sub === 'vendor_info') {
      try {
        const result = await tavilySearch(`${keywords} YouTube 頻道 廠商 品牌 聯絡 電話 email 官網`, perQ)
        parts.push(`🎬 YouTube 廠商資料：\n${result}`)
      } catch { /* skip */ }
      continue
    }
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
    if (sub === 'vendor_info') {
      const result = await tavilySearch(`Amazon ${keywords} seller vendor brand 廠商 聯絡 電話 email 官網`, perQ)
      parts.push(`📦 Amazon 廠商資料：\n${result}`)
      continue
    }
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
    if (sub === 'vendor_info') {
      const result = await tavilySearch(`Shopee ${domain} ${keywords} 賣家 店家 廠商 聯絡 電話 email 官網`, perQ)
      parts.push(`🛒 Shopee 廠商資料：\n${result}`)
      continue
    }
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
async function appReviews(appIds: string[], keywords: string, subOptions: string[], limit: number): Promise<string> {
  const parts: string[] = []

  if (subOptions.includes('vendor_info')) {
    try {
      const q = appIds.length > 0
        ? `App Store Google Play ${keywords} developer company 開發商 廠商 聯絡 電話 email 官網`
        : `${keywords} app 開發商 廠商 聯絡 電話 email 官網`
      const result = await tavilySearch(q, Math.ceil(limit / 2))
      parts.push(`📲 iOS/Android 廠商資料：\n${result}`)
    } catch { /* skip */ }
  }

  if (!subOptions.includes('reviews') && subOptions.length > 0 && !subOptions.includes('vendor_info')) {
    return parts.join('\n\n') || '⚠️ 無 App 評論資料'
  }

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

// ── 11. Dcard（公開 API，免費）────────────────────────────────────────────────────

async function dcardSearch(keywords: string, limit: number): Promise<string> {
  const parts: string[] = []
  const ua = 'Mozilla/5.0 (compatible; AIGate/1.0)'

  try {
    const url = `https://www.dcard.tw/service/api/v2/search/posts?query=${encodeURIComponent(keywords)}&limit=${Math.min(limit, 30)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Referer': 'https://www.dcard.tw/',
        'Accept': 'application/json',
      },
    })
    if (res.ok) {
      const posts = await res.json() as Array<{
        id: number; title: string; excerpt?: string
        likeCount: number; commentCount: number
        forumName: string; forumAlias?: string; createdAt: string
      }>
      if (posts.length > 0) {
        const lines = posts.slice(0, limit).map(p =>
          `▶ [${p.forumName}] ${p.title}\n  ❤️ ${p.likeCount} · 💬 ${p.commentCount} · ${p.createdAt?.slice(0, 10) ?? ''}\n  ${p.excerpt ? p.excerpt.slice(0, 120) + '…' : ''}\n  🔗 https://www.dcard.tw/f/${p.forumAlias ?? 'all'}/p/${p.id}`
        )
        parts.push(`💚 Dcard 熱門討論（${posts.length} 則）：\n\n${lines.join('\n\n---\n\n')}`)
      } else {
        parts.push('💚 Dcard：無相關文章')
      }
    } else {
      parts.push(`💚 Dcard API 回應異常 (${res.status})`)
    }
  } catch (e) {
    parts.push(`💚 Dcard 查詢失敗：${String(e)}`)
  }

  return parts.join('\n\n') || '⚠️ 無 Dcard 資料'
}

// ── 12. Booking.com + Airbnb 評論（Tavily site search）─────────────────────────

async function bookingAirbnbSearch(keywords: string, subOptions: string[], limit: number): Promise<string> {
  const parts: string[] = []
  const perQ = Math.max(3, Math.ceil(limit / 2))

  if (subOptions.includes('booking')) {
    try {
      const q = `site:booking.com ${keywords} 評論 台灣`
      const result = await tavilySearch(q, perQ)
      parts.push(`🏨 Booking.com 評論：\n${result}`)
    } catch { /* skip */ }

    try {
      const q2 = `booking.com "${keywords}" guest reviews what guests loved`
      const result2 = await tavilySearch(q2, perQ)
      parts.push(`🏨 Booking.com 英文評論：\n${result2}`)
    } catch { /* skip */ }
  }

  if (subOptions.includes('airbnb')) {
    try {
      const q = `site:airbnb.com ${keywords} 台灣 reviews`
      const result = await tavilySearch(q, perQ)
      parts.push(`🏠 Airbnb 評論：\n${result}`)
    } catch { /* skip */ }

    try {
      const q2 = `airbnb "${keywords}" guest review "loved" OR "great" OR "perfect"`
      const result2 = await tavilySearch(q2, perQ)
      parts.push(`🏠 Airbnb 英文評論：\n${result2}`)
    } catch { /* skip */ }
  }

  return parts.join('\n\n') || '⚠️ 無訂房平台評論資料'
}

// ── 13. 社群熱點：Reddit + HN + Polymarket（全免費，無需 API key）────────────────

async function trendResearch(keywords: string, subOptions: string[]): Promise<string> {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 86400000) / 1000)
  const parts: string[] = []
  const ua = 'Mozilla/5.0 (compatible; AIGate/1.0)'

  // ─ Reddit ──────────────────────────────────────────────────────────────────
  if (subOptions.includes('reddit')) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keywords)}&sort=top&t=month&limit=10&type=link`
      const res = await fetch(url, { headers: { 'User-Agent': ua } })
      if (res.ok) {
        const data = await res.json()
        const posts = (data?.data?.children ?? []) as Array<{
          data: { title: string; subreddit: string; score: number; num_comments: number; url: string; selftext?: string }
        }>
        if (posts.length > 0) {
          const lines = posts.slice(0, 8).map(p => {
            const d = p.data
            return `▶ [r/${d.subreddit}] ${d.title}\n  👍 ${d.score.toLocaleString()} · 💬 ${d.num_comments} comments\n  ${d.url}`
          })
          parts.push(`🔴 Reddit 近30天熱門討論（依投票數排序）：\n\n${lines.join('\n\n')}`)
        } else {
          parts.push('🔴 Reddit：無相關討論')
        }
      }
    } catch (e) {
      parts.push(`🔴 Reddit 查詢失敗：${String(e)}`)
    }
  }

  // ─ Hacker News ─────────────────────────────────────────────────────────────
  if (subOptions.includes('hackernews')) {
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keywords)}&tags=story&numericFilters=created_at_i%3E${thirtyDaysAgo}&hitsPerPage=8&attributesToRetrieve=title,url,points,num_comments,created_at`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const hits = (data?.hits ?? []) as Array<{
          title: string; url?: string; points: number; num_comments: number; created_at: string
        }>
        if (hits.length > 0) {
          const lines = hits.map(h =>
            `▶ ${h.title}\n  👍 ${h.points ?? 0} pts · 💬 ${h.num_comments ?? 0} comments · ${h.created_at?.slice(0, 10) ?? ''}\n  ${h.url ?? '(ask/show HN)'}`
          )
          parts.push(`🟠 Hacker News 近30天熱門：\n\n${lines.join('\n\n')}`)
        } else {
          parts.push('🟠 Hacker News：無相關貼文')
        }
      }
    } catch (e) {
      parts.push(`🟠 Hacker News 查詢失敗：${String(e)}`)
    }
  }

  // ─ Polymarket ──────────────────────────────────────────────────────────────
  if (subOptions.includes('polymarket')) {
    try {
      const url = `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(keywords)}&limit=5&order=volume&ascending=false&active=true`
      const res = await fetch(url, { headers: { 'User-Agent': ua } })
      if (res.ok) {
        const markets = await res.json() as Array<{
          question: string; volume?: number; liquidity?: number
          outcomes?: string[]; outcomePrices?: string[]; endDate?: string
        }>
        if (markets.length > 0) {
          const lines = markets.map(m => {
            const vol = m.volume ? `$${Number(m.volume).toLocaleString()}` : '-'
            const outcomes = (m.outcomes ?? []).map((o, i) => `${o}: ${(Number(m.outcomePrices?.[i] ?? 0) * 100).toFixed(0)}%`).join(' / ')
            return `▶ ${m.question}\n  💰 成交量：${vol} · ${outcomes || ''}\n  📅 截止：${m.endDate?.slice(0, 10) ?? '不限'}`
          })
          parts.push(`📈 Polymarket 市場預測（真實資金押注）：\n\n${lines.join('\n\n')}`)
        } else {
          parts.push('📈 Polymarket：無相關預測市場')
        }
      }
    } catch (e) {
      parts.push(`📈 Polymarket 查詢失敗：${String(e)}`)
    }
  }

  return parts.join('\n\n') || '⚠️ 無社群熱點資料'
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
    const sub = getSub('ios_android', ['reviews'])
    tasks.push(appReviews(appIds, kw, sub, limit).then(r => ['📱 iOS/Android', r]))
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
  if (selectedTypes.includes('trend')) {
    const sub = getSub('trend', ['reddit', 'hackernews', 'polymarket'])
    tasks.push(trendResearch(kw, sub).then(r => ['🔥 社群熱點 (近30天)', r]))
  }
  if (selectedTypes.includes('dcard')) {
    tasks.push(dcardSearch(kw, limit).then(r => ['💚 Dcard', r]))
  }
  if (selectedTypes.includes('booking')) {
    const sub = getSub('booking', ['booking', 'airbnb'])
    tasks.push(bookingAirbnbSearch(kw, sub, limit).then(r => ['🏨 訂房平台評論', r]))
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

  const LANG_NAMES: Record<string, string> = {
    'zh-TW': '繁體中文', 'zh-CN': '简体中文', 'en': 'English', 'vi': 'Tiếng Việt',
  }
  const langName = LANG_NAMES[language] ?? '繁體中文'

  const { text: summary } = await generateText({
    model: deepseek.chat('deepseek-chat'),
    messages: [{
      role: 'system',
      content: `你是一位市場調查分析師，擅長從多元來源資料中提煉行銷洞察。請務必「全部」以 ${langName} 輸出清晰結構化報告，包含所有區段標題與內容；即使原始資料是其他語言，也要翻譯成 ${langName}。`,
    }, {
      role: 'user',
      content: `請根據以下蒐集到的資料，整理成完整的行銷情報摘要。
輸出語言：${langName}（所有標題與內容都必須使用此語言）。

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
