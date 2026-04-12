import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

// Internal model ID → OpenRouter model string（付費模型，穩定可靠）
const MODEL_MAP: Record<string, string> = {
  'or-gpt-4o-mini':    'openai/gpt-4o-mini',
}

export async function streamOpenRouter(params: ChatParams) {
  const openrouter = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://ai-gate-app-gamma.vercel.app',
      'X-Title': 'AI GATE',
    },
  })

  const modelName = MODEL_MAP[params.modelId] ?? MODEL_MAP['or-llama-3.3-70b']

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: openrouter.chat(modelName),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
