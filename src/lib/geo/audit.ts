/**
 * GEO Score 落地頁審計 — 抓取已發佈 URL，算 0–100 綜合分。
 * 維度（無外部品牌掃描，權重重分配）：
 *   可引用度 30 / 結構化資料 20 / 技術基礎 20 / E-E-A-T 15 / AI 爬蟲放行 15
 */
import { scoreCitability } from './citability'
import { checkCrawlers, normDomain } from './crawlers'

export interface AuditResult {
  url: string
  total: number
  breakdown: { key: string; label: string; score: number; max: number; note: string }[]
  schemaTypes: string[]
  blockedCrawlers: number
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractJsonLdTypes(html: string): string[] {
  const types: string[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim())
      const collect = (o: unknown) => {
        if (Array.isArray(o)) return o.forEach(collect)
        if (o && typeof o === 'object') {
          const rec = o as Record<string, unknown>
          if (rec['@type']) types.push(String(rec['@type']))
          if (rec['@graph']) collect(rec['@graph'])
        }
      }
      collect(data)
    } catch { /* ignore */ }
  }
  return [...new Set(types)]
}

export async function auditUrl(url: string): Promise<AuditResult> {
  const full = url.startsWith('http') ? url : `https://${url}`
  let html = ''
  try {
    const res = await fetch(full, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GEO-Writer audit)' },
      signal: AbortSignal.timeout(12000),
    })
    html = await res.text()
  } catch (err) {
    throw new Error(`無法抓取頁面：${String(err)}`)
  }

  const text = stripHtml(html)
  const schemaTypes = extractJsonLdTypes(html)

  // 1) 可引用度（30）
  const cit = scoreCitability(text)
  const citScore = Math.round((cit.score / 100) * 30)

  // 2) 結構化資料（20）
  let schemaScore = 0
  if (schemaTypes.length > 0) schemaScore += 8
  if (schemaTypes.some(t => /Article/i.test(t))) schemaScore += 4
  if (schemaTypes.some(t => /FAQPage/i.test(t))) schemaScore += 4
  if (schemaTypes.some(t => /Organization|LocalBusiness/i.test(t))) schemaScore += 4

  // 3) 技術基礎（20）
  const hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(html)
  const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html)
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length
  const h2Count = (html.match(/<h[23][\s>]/gi) ?? []).length
  const words = (text.match(/[一-鿿]|[A-Za-z0-9]+/g) ?? []).length
  let techScore = 0
  if (hasTitle) techScore += 5
  if (hasMetaDesc) techScore += 5
  if (h1Count === 1) techScore += 4
  if (h2Count >= 2) techScore += 3
  if (words >= 600) techScore += 3

  // 4) E-E-A-T（15）：作者署名（schema Person 或 by/作者）
  const hasAuthor = schemaTypes.some(t => /Person/i.test(t)) ||
    /author|作者|by\s+[A-Z一-鿿]/i.test(html)
  const eeatScore = hasAuthor ? 15 : 0

  // 5) AI 爬蟲放行（15）
  const crawl = await checkCrawlers(normDomain(full))
  const total = crawl.crawlers.length || 1
  const allowed = crawl.crawlers.filter(c => c.allowed).length
  const crawlerScore = Math.round((allowed / total) * 15)

  const breakdown = [
    { key: 'citability', label: '段落可引用度', score: citScore, max: 30, note: `整體 ${cit.score}/100` },
    { key: 'schema', label: '結構化資料', score: schemaScore, max: 20, note: schemaTypes.length ? schemaTypes.join(', ') : '未偵測到 JSON-LD' },
    { key: 'technical', label: '技術基礎', score: techScore, max: 20, note: `標題${hasTitle ? '✓' : '✗'} 描述${hasMetaDesc ? '✓' : '✗'} H1×${h1Count} 字數${words}` },
    { key: 'eeat', label: 'E-E-A-T 署名', score: eeatScore, max: 15, note: hasAuthor ? '偵測到作者' : '未偵測到作者署名' },
    { key: 'crawlers', label: 'AI 爬蟲放行', score: crawlerScore, max: 15, note: `${allowed}/${total} 允許${crawl.blockedCount ? `，${crawl.blockedCount} 被擋` : ''}` },
  ]

  return {
    url: full,
    total: breakdown.reduce((s, b) => s + b.score, 0),
    breakdown,
    schemaTypes,
    blockedCrawlers: crawl.blockedCount,
  }
}
