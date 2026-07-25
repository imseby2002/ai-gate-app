import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'
import type { ChatParams } from './cli-proxy'

// FREE_LLM_URL 這個環境變數，程式碼裡曾經同時存在兩種互相矛盾的假設：
// 有的地方（如舊版 free-status 健康檢查）自己手動補 /v1，有的地方（這支檔案、csReply.ts、
// proxy-fallback.ts）直接把它原封不動丟給 createOpenAI({ baseURL }) 當前綴。
// AI SDK 的 baseURL 不會自動補 /v1，所以環境變數沒帶 /v1 時，實際打出去的路徑
// 會變成 .../chat/completions（缺 /v1），打到路由服務的前端頁面而非 API，靜默失敗、
// 整條 FreeLLM 備援形同虛設。這裡統一正規化，不管環境變數有沒有帶 /v1 都會處理好。
export function normalizeFreeLlmBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

export function isFreeLlmAvailable() {
  const url = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const key = process.env.FREE_LLM_API_KEY
  return !!(url && key)
}

function getFreeLlmProvider(model: string) {
  const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const baseURL = rawUrl ? normalizeFreeLlmBaseUrl(rawUrl) : rawUrl
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
