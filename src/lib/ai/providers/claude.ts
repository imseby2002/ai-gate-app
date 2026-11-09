import { streamText } from 'ai'
import type { ChatParams } from './deepseek'
import { createChainModel } from '../proxy-fallback'

// ai_models 保留舊 ID（歷史訊息與計費紀錄引用），實際呼叫同系列新版：
// Opus 4.5 → Opus 5.5（$4/$20），Sonnet 4.5 → Sonnet 5.5（$2/$10）。DB 顯示名稱與單價已同步更新。
const MODEL_MAP: Record<string, string> = {
  'claude-opus-4-5':   'claude-opus-5-5',
  'claude-sonnet-4-5': 'claude-sonnet-5-5',
  'claude-sonnet-4-6': 'claude-sonnet-5-5',
}

export async function streamClaude(params: ChatParams) {
  const claudeModel = MODEL_MAP[params.modelId] ?? (params.modelId.startsWith('claude-') && /-5-/.test(params.modelId) ? params.modelId : 'claude-sonnet-5-5')

  // 鏈式模型會處理 Claude 5.x 參數（不送 temperature、max_tokens 下限，避免 thinking 吃光輸出）
  return streamText({
    model: createChainModel([{ via: 'direct', provider: 'anthropic', model: claudeModel }]),
    system: params.systemPrompt,
    messages: params.messages,
    maxOutputTokens: Math.max(params.maxTokens ?? 4096, 16000),
  })
}
