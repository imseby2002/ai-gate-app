import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

export interface ChatParams {
  modelId: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  systemPrompt?: string
  maxTokens?: number
}

// Models the proxy supports (must match config.yaml aliases)
export const CLI_PROXY_MODELS: Record<string, string> = {
  'claude-sonnet-4-6':        'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001':'claude-haiku-4-5-20251001',
  'gemini-2.5-flash':         'gemini-2.5-flash',
  'gemini-2.5-pro':           'gemini-2.5-pro',
  'deepseek-chat':            'deepseek-chat',
}

export function isCliProxyAvailable() {
  return !!(process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL)
}

export async function streamCliProxy(params: ChatParams) {
  const baseURL = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const apiKey  = process.env.CLI_PROXY_API_KEY ?? 'no-key'

  const proxy = createOpenAI({ apiKey, baseURL })

  const modelName = CLI_PROXY_MODELS[params.modelId] ?? params.modelId

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: proxy.chat(modelName),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
