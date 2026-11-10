// 網路搜尋工具：走共用搜尋鏈（免費 FreeLLM / CLIProxy → Gemini＋Google 搜尋 → Perplexity → Claude 搜尋）。
import { webSearchGenerate } from '@/lib/ai/web-search'
import type { AgentToolDef } from '../types'

interface WebSearchInput {
  query: string
}

export const webSearchTool: AgentToolDef = {
  id: 'web_search',
  description: '搜尋網路上具時效性的資訊（新聞、公開資料、法規、市場動態等），回傳摘要文字。',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '要搜尋的關鍵字或問題' },
    },
    required: ['query'],
  },
  async execute(rawInput) {
    const input = rawInput as unknown as WebSearchInput
    try {
      const r = await webSearchGenerate({
        system: '你是研究助理。請用網路搜尋查證後，以繁體中文精簡回答，並列出參考來源網址。',
        messages: [{ role: 'user', content: input.query }],
        maxOutputTokens: 1500,
        maxSearches: 3,
        feature: 'agent',
      })
      return { summary: r.text, sources: r.sources.slice(0, 8) }
    } catch (e) {
      return { error: `搜尋失敗：${e instanceof Error ? e.message : String(e)}` }
    }
  },
}
