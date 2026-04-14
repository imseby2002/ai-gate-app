import { createGroq } from '@ai-sdk/groq'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

// Groq model ID → actual Groq model name
const MODEL_MAP: Record<string, string> = {
  'groq-llama-3.3-70b': 'llama-3.3-70b-versatile',   // 通用主力，極快
  'groq-qwen3-32b':     'qwen/qwen3-32b',             // 推理/分析，支援繁體中文
  'groq-qwq-32b':       'qwen-qwq-32b',               // 數學/邏輯推理
}

// 若模型 ID 為 "groq-auto"，自動選最佳通用模型
const GROQ_AUTO_MODEL = 'llama-3.3-70b-versatile'

export async function streamGroq(params: ChatParams) {
  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY!,
  })

  const modelName = params.modelId === 'groq-auto'
    ? GROQ_AUTO_MODEL
    : (MODEL_MAP[params.modelId] ?? GROQ_AUTO_MODEL)

  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: groq(modelName),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
