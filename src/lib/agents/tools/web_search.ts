// 網路搜尋工具：透過 Perplexity 線上模型取得具時效性的搜尋結果。
// 沿用 src/lib/ai/providers/perplexity.ts 的 baseURL/模型設定，不重造 provider。
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { AgentToolDef } from '../types'

interface WebSearchInput {
  query: string
}

export const webSearchTool: AgentToolDef<WebSearchInput> = {
  id: 'web_search',
  description: '搜尋網路上具時效性的資訊（新聞、公開資料、法規、市場動態等），回傳摘要文字。',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '要搜尋的關鍵字或問題' },
    },
    required: ['query'],
  },
  async execute(input) {
    if (!process.env.PERPLEXITY_API_KEY) return { error: 'PERPLEXITY_API_KEY 未設定' }
    const perplexity = createOpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
    const res = await generateText({
      model: perplexity.chat('llama-3.1-sonar-large-128k-online'),
      messages: [{ role: 'user', content: input.query }],
      maxOutputTokens: 1500,
    })
    return { summary: res.text }
  },
}
