import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

export async function streamPerplexity(params: ChatParams) {
  const perplexity = createOpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY!,
    baseURL: 'https://api.perplexity.ai',
  })

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    // 舊型號 llama-3.1-sonar-* 已不在 Perplexity 官方型號清單；改用 sonar-pro（對應 ai_models 的 perplexity-sonar-pro）
    model: perplexity.chat('sonar-pro'),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
