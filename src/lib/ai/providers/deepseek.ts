import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

export interface ChatParams {
  modelId: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  systemPrompt?: string
  maxTokens?: number
}

export async function streamDeepSeek(params: ChatParams) {
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })

  const modelName = params.modelId === 'deepseek-reasoner'
    ? 'deepseek-reasoner'
    : 'deepseek-chat'

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: deepseek(modelName),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
