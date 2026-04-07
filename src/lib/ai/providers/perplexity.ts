import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

export async function streamPerplexity(params: ChatParams) {
  const perplexity = createOpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY!,
    baseURL: 'https://api.perplexity.ai',
    compatibility: 'compatible',
  })

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: perplexity('llama-3.1-sonar-large-128k-online'),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
