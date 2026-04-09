import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

// Internal model ID → OpenRouter model string
// 注意：free tier 有 rate limit，繁忙時可能失敗
const MODEL_MAP: Record<string, string> = {
  'or-llama-3.3-70b':  'meta-llama/llama-3.3-70b-instruct:free',
  'or-qwen3-80b':      'meta-llama/llama-3.3-70b-instruct:free', // qwen3 free tier 無可用端點
  'or-qwen-coder':     'meta-llama/llama-3.3-70b-instruct:free', // qwen2.5-coder free 已失效
  'or-gemma-3-27b':    'google/gemma-3-27b-it:free',
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
