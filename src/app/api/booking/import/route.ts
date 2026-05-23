import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

export const maxDuration = 60 // seconds (Vercel Hobby max)

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Strip HTML to plain text, preserve JSON-LD blocks
function extractTextFromHtml(html: string): { text: string; jsonLd: string } {
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) ?? []
  const jsonLd = jsonLdMatches.map(m => m.replace(/<[^>]+>/g, '')).join('\n')

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s{3,}/g, '\n').trim()
    .slice(0, 12000)

  return { text, jsonLd }
}

async function fetchWithScrapfly(url: string, renderJs = false): Promise<string | null> {
  const key = process.env.SCRAPFLY_API_KEY
  if (!key) return null
  try {
    const { ScrapflyClient, ScrapeConfig } = await import('scrapfly-sdk')
    const client = new ScrapflyClient({ key })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.scrape(new ScrapeConfig({
      url,
      asp: true,
      render_js: renderJs,
      country: 'tw',
    }))
    return result.result?.content ?? null
  } catch {
    return null
  }
}

// curl_cffi + Camoufox microservice (for Agoda / primary bypass)
async function fetchWithPyScraper(url: string): Promise<string | null> {
  const scraperUrl = process.env.OTA_SCRAPER_URL
  const scraperKey = process.env.OTA_SCRAPER_KEY
  if (!scraperUrl) return null
  try {
    const res = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(scraperKey ? { 'X-Api-Key': scraperKey } : {}),
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(40000), // Camoufox can be slow
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.html ?? null
  } catch {
    return null
  }
}

async function fetchBasic(url: string, platform?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    }
    if (platform === 'booking_com') headers['Referer'] = 'https://www.booking.com/'
    if (platform === 'agoda') headers['Referer'] = 'https://www.agoda.com/'

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// Routing strategy per platform
async function fetchHtml(url: string, platform: string): Promise<string | null> {
  if (platform === 'booking_com') {
    // ScrapFly → Python scraper → basic fetch
    return (await fetchWithScrapfly(url))
      ?? (await fetchWithPyScraper(url))
      ?? (await fetchBasic(url, platform))
  }
  if (platform === 'agoda') {
    // ScrapFly JS render → Python scraper → ScrapFly no-JS → basic fetch
    return (await fetchWithScrapfly(url, true))
      ?? (await fetchWithPyScraper(url))
      ?? (await fetchWithScrapfly(url, false))
      ?? (await fetchBasic(url, platform))
  }
  // Airbnb / other: ScrapFly → Python → basic
  return (await fetchWithScrapfly(url))
    ?? (await fetchWithPyScraper(url))
    ?? (await fetchBasic(url, platform))
}

const SYSTEM_PROMPT = `You are a data extraction assistant. Extract B&B / hotel property information from the provided webpage text and return ONLY valid JSON.

Return this exact JSON shape (use null for missing fields):
{
  "name": "property name",
  "description": "full description in original language",
  "address": "street address",
  "city": "city name",
  "phone": "phone number or null",
  "email": "email or null",
  "website": null,
  "check_in_time": "HH:MM or null",
  "check_out_time": "HH:MM or null",
  "min_nights": 1,
  "house_rules": "house rules text or null",
  "amenities": ["amenity1", "amenity2"],
  "rooms": [
    {
      "name": "room type name",
      "description": "room description or null",
      "max_guests": 2,
      "base_price": null
    }
  ]
}

Rules:
- amenities: extract facility/service names as short strings (e.g. "WiFi", "停車位", "早餐", "冷氣")
- check_in_time / check_out_time: format as "15:00"
- If pricing is unavailable, set base_price to null
- If no rooms found, return rooms as []
- Return ONLY the JSON object, no markdown, no explanation`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, text: pastedText, platform } = await req.json()

  let rawContent = pastedText ?? ''

  // Try URL fetch if provided
  if (url && !rawContent) {
    const html = await fetchHtml(url, platform ?? 'other')
    if (html) {
      const { text, jsonLd } = extractTextFromHtml(html)
      const combined = jsonLd ? `=== Structured Data ===\n${jsonLd}\n\n=== Page Text ===\n${text}` : text
      if (combined.trim().length >= 20) rawContent = combined
    }
  }

  if (!rawContent || rawContent.trim().length < 20) {
    return NextResponse.json({
      error: '無法取得頁面內容，請手動複製貼上民宿說明文字',
      fetch_failed: true,
    }, { status: 422 })
  }

  const prompt = `Platform: ${platform ?? 'unknown'}\n\nContent:\n${rawContent.slice(0, 14000)}`

  try {
    const { text: aiResponse } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 2000,
    })

    // Parse AI JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI did not return valid JSON')
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({ parsed })
  } catch (e) {
    return NextResponse.json({ error: `AI 解析失敗：${e instanceof Error ? e.message : '未知錯誤'}` }, { status: 500 })
  }
}
