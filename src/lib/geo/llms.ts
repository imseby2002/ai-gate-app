/**
 * llms.txt 產生器 — 放在網站根目錄 /llms.txt，主動告訴 AI 你的站在賣什麼、有哪些重點頁面，
 * 提升被 AI 引擎理解與引用的機率（llms.txt 新興標準）。
 */
export interface LlmsInput {
  siteName: string
  summary: string
  domain?: string | null
  articles: { title: string; url?: string | null; desc?: string | null }[]
}

export function buildLlmsTxt(input: LlmsInput): string {
  const lines: string[] = []
  lines.push(`# ${input.siteName}`)
  lines.push('')
  if (input.summary) { lines.push(`> ${input.summary}`); lines.push('') }

  const published = input.articles.filter(a => a.url)
  const drafts = input.articles.filter(a => !a.url)

  if (published.length) {
    lines.push('## 重點內容')
    for (const a of published) {
      lines.push(`- [${a.title}](${a.url})${a.desc ? `: ${a.desc}` : ''}`)
    }
    lines.push('')
  }
  if (drafts.length) {
    lines.push('## 內容主題')
    for (const a of drafts) {
      lines.push(`- ${a.title}${a.desc ? `: ${a.desc}` : ''}`)
    }
    lines.push('')
  }
  if (input.domain) {
    lines.push('## 聯絡')
    lines.push(`- 官方網站：https://${input.domain.replace(/^https?:\/\//, '')}`)
  }
  return lines.join('\n').trim() + '\n'
}
