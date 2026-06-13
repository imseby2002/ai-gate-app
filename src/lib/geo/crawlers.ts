/**
 * AI 爬蟲放行檢查 — 解析目標網域 robots.txt，判斷各大 AI 引擎爬蟲是否被允許。
 * 被引用 6 要素之一：放行 AI 爬蟲。被擋＝AI 永遠看不到你的內容。
 */
export interface CrawlerStatus {
  bot: string
  purpose: string
  allowed: boolean
}

export interface CrawlerReport {
  domain: string
  robotsFound: boolean
  crawlers: CrawlerStatus[]
  blockedCount: number
}

// 主要 AI 爬蟲（user-agent）與用途
const AI_CRAWLERS: { bot: string; purpose: string }[] = [
  { bot: 'GPTBot', purpose: 'OpenAI 訓練/索引' },
  { bot: 'OAI-SearchBot', purpose: 'ChatGPT Search' },
  { bot: 'ChatGPT-User', purpose: 'ChatGPT 即時瀏覽' },
  { bot: 'ClaudeBot', purpose: 'Anthropic Claude' },
  { bot: 'anthropic-ai', purpose: 'Anthropic 索引' },
  { bot: 'PerplexityBot', purpose: 'Perplexity 索引' },
  { bot: 'Perplexity-User', purpose: 'Perplexity 即時' },
  { bot: 'Google-Extended', purpose: 'Google Gemini/AIO' },
  { bot: 'Applebot-Extended', purpose: 'Apple Intelligence' },
  { bot: 'Amazonbot', purpose: 'Amazon/Alexa' },
  { bot: 'Bytespider', purpose: '字節跳動/豆包' },
  { bot: 'CCBot', purpose: 'Common Crawl（多數 LLM 來源）' },
  { bot: 'Meta-ExternalAgent', purpose: 'Meta AI' },
  { bot: 'cohere-ai', purpose: 'Cohere' },
]

export function normDomain(s: string): string {
  return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase().trim()
}

interface Group { agents: string[]; disallow: string[]; allow: string[] }

function parseRobots(txt: string): Group[] {
  const groups: Group[] = []
  let cur: Group | null = null
  let lastWasAgent = false
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (field === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], disallow: [], allow: [] }; groups.push(cur) }
      cur.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if (cur && (field === 'disallow' || field === 'allow')) {
      lastWasAgent = false
      if (field === 'disallow') cur.disallow.push(value)
      else cur.allow.push(value)
    }
  }
  return groups
}

/** 某爬蟲是否被允許爬根路徑（最具體匹配優先；明確 Disallow: / 且無 Allow: / 視為封鎖）。 */
function isAllowed(groups: Group[], bot: string): boolean {
  const b = bot.toLowerCase()
  const specific = groups.find(g => g.agents.includes(b))
  const wildcard = groups.find(g => g.agents.includes('*'))
  const g = specific ?? wildcard
  if (!g) return true // 無規則＝允許
  const blockedAll = g.disallow.some(d => d === '/' )
  const allowedRoot = g.allow.some(a => a === '/' )
  if (blockedAll && !allowedRoot) return false
  return true
}

export async function checkCrawlers(domain: string): Promise<CrawlerReport> {
  const d = normDomain(domain)
  let txt = ''
  let robotsFound = false
  try {
    const res = await fetch(`https://${d}/robots.txt`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GEO-Writer crawler-check)' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) { txt = await res.text(); robotsFound = true }
  } catch { /* 無 robots.txt 視為全允許 */ }

  const groups = robotsFound ? parseRobots(txt) : []
  const crawlers: CrawlerStatus[] = AI_CRAWLERS.map(c => ({
    bot: c.bot,
    purpose: c.purpose,
    allowed: robotsFound ? isAllowed(groups, c.bot) : true,
  }))

  return {
    domain: d,
    robotsFound,
    crawlers,
    blockedCount: crawlers.filter(c => !c.allowed).length,
  }
}
