import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'
import type { ChatParams } from './cli-proxy'

export function isFreeLlmAvailable() {
  const url = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const key = process.env.FREE_LLM_API_KEY
  return !!(url && key)
}

function getFreeLlmProvider(model: string) {
  const baseURL = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const apiKey  = process.env.FREE_LLM_API_KEY ?? 'no-key'
  const provider = createOpenAI({ apiKey, baseURL })
  return provider.chat(model)
}

export async function streamFreeLlm(params: ChatParams & { model?: string }) {
  const model = params.model ?? 'auto'
  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return streamText({
    model: getFreeLlmProvider(model),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}

export async function generateFreeLlm(params: ChatParams & { model?: string }) {
  const model = params.model ?? 'auto'
  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  return generateText({
    model: getFreeLlmProvider(model),
    messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
