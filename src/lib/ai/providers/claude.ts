import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { ChatParams } from './deepseek'

const MODEL_MAP: Record<string, string> = {
  'claude-opus-4-5':   'claude-opus-4-5-20251101',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
}

export async function streamClaude(params: ChatParams) {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const claudeModel = MODEL_MAP[params.modelId] ?? 'claude-sonnet-4-5'

  return streamText({
    model: anthropic(claudeModel),
    system: params.systemPrompt,
    messages: params.messages,
    maxOutputTokens: params.maxTokens ?? 4096,
  })
}
