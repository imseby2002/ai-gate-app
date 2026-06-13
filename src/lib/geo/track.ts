/**
 * GEO 追蹤共用邏輯 — 用 Perplexity online 模擬「使用者向 AI 提問」，
 * 取回會被引用的來源清單，判斷目標網域是否在內、排名第幾。
 * 寫入 geo_tracking（engine='perplexity'）。
 */
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export interface TrackInput {
  id: string            // question id
  question: string
  target: string        // 目標網域/品牌（用於判斷是否被引用）
}

export interface TrackResult {
  id: string
  cited: boolean
  rank: number | null
  sources: string[]
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return null }
}

export function deriveTarget(publishedUrl: string | null | undefined): string {
  return hostOf(publishedUrl) || process.env.GEO_BRAND_DOMAIN || 'im-tourist.com'
}

async function checkOne(q: TrackInput, locale: string): Promise<TrackResult | null> {
  if (!process.env.PERPLEXITY_API_KEY) return null
  try {
    const perplexity = createOpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
    const { text } = await generateText({
      model: perplexity.chat('sonar'),
      messages: [{
        role: 'user',
        content: `請以「使用者實際向 AI 搜尋」的角度回答：「${q.question}」（語系 ${locale}）。
回答後，於最後輸出一段 JSON，列出你引用或參考的來源網域（去掉 www、只要 hostname），依引用重要性排序：
{"sources":["domain1.com","domain2.com"]}`,
      }],
      maxOutputTokens: 900,
    })
    const m = text.match(/\{[\s\S]*"sources"[\s\S]*\}/)
    let sources: string[] = []
    if (m) {
      try {
        const parsed = JSON.parse(m[0])
        if (Array.isArray(parsed.sources)) {
          sources = parsed.sources
            .filter((s: unknown) => typeof s === 'string')
            .map((s: string) => s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase())
        }
      } catch { /* ignore */ }
    }
    const target = q.target.toLowerCase()
    const idx = sources.findIndex(s => s === target || s.endsWith(`.${target}`) || s.includes(target))
    return { id: q.id, cited: idx >= 0, rank: idx >= 0 ? idx + 1 : null, sources }
  } catch (err) {
    console.error('[geo/track] checkOne', err)
    return null
  }
}

/** 逐題追蹤並寫入 geo_tracking。db 可為 server client 或 admin client。 */
export async function trackQuestions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  questions: TrackInput[],
  locale: string,
): Promise<TrackResult[]> {
  const out: TrackResult[] = []
  const CONCURRENCY = 3
  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const batch = questions.slice(i, i + CONCURRENCY)
    const res = (await Promise.all(batch.map(q => checkOne(q, locale)))).filter((r): r is TrackResult => !!r)
    out.push(...res)
  }
  if (out.length > 0) {
    await db.from('geo_tracking').insert(out.map(r => ({
      question_id: r.id,
      engine: 'perplexity',
      cited: r.cited,
      rank: r.rank,
      cited_sources: r.sources,
    })))
  }
  return out
}
