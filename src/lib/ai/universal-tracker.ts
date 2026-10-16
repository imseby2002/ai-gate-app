import { createAdminClient } from '@/lib/supabase/admin'
import {
  detectSourceChannel,
  calculateModelCosts,
  type SourceChannel,
} from './token-cost-tracker'

export type FeatureModule =
  | 'meeting'
  | 'store_coach'
  | 'marketing'
  | 'audit'
  | 'rd'
  | 'affairs'
  | 'skills'
  | 'autofix'
  | 'email_sync'
  | 'chat'
  | 'roundtable'
  | 'agent'
  | 'missions'
  | 'other'

export interface TrackAiUsageParams {
  feature: FeatureModule
  modelId: string
  inputTokens: number
  outputTokens: number
  costUsd?: number
  savedUsd?: number
  sourceChannel?: SourceChannel | 'direct'
  metadata?: Record<string, unknown>
}

/**
 * 萬用 AI 使用量與成本追蹤器 (Universal AI Usage Tracker)
 * 自動計算 Token 成本，並將用量同時寫入 ai_feature_usage_daily 與相容的 ai_source_usage_daily。
 * 設計為背景非同步執行 (Fire-and-forget)，完全不阻斷核心業務邏輯。
 */
export async function trackAiUsage(params: TrackAiUsageParams): Promise<void> {
  const {
    feature,
    modelId,
    inputTokens,
    outputTokens,
    metadata,
  } = params

  try {
    const today = new Date().toISOString().split('T')[0]
    const inTokens = Math.max(0, Math.round(inputTokens || 0))
    const outTokens = Math.max(0, Math.round(outputTokens || 0))

    // 判斷來源通道與成本
    const channel = (params.sourceChannel && params.sourceChannel !== 'direct')
      ? params.sourceChannel
      : detectSourceChannel(modelId)

    let totalCostUsd = params.costUsd
    let savedCostUsd = params.savedUsd ?? 0

    if (totalCostUsd === undefined) {
      const calc = calculateModelCosts(modelId, inTokens, outTokens, channel)
      totalCostUsd = calc.actualCostUsd
      if (savedCostUsd === 0) {
        savedCostUsd = calc.savedCostUsd
      }
    }

    const supabase = createAdminClient()

    // 1. 寫入或累加到各模組統計表 public.ai_feature_usage_daily
    try {
      const { data: existing } = await supabase
        .from('ai_feature_usage_daily')
        .select('request_count, input_tokens, output_tokens, total_cost_usd, saved_cost_usd')
        .eq('date', today)
        .eq('feature_module', feature)
        .eq('model_id', modelId)
        .eq('source_channel', channel)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('ai_feature_usage_daily')
          .update({
            request_count: (existing.request_count ?? 0) + 1,
            input_tokens: Number(existing.input_tokens ?? 0) + inTokens,
            output_tokens: Number(existing.output_tokens ?? 0) + outTokens,
            total_cost_usd: Number((Number(existing.total_cost_usd ?? 0) + totalCostUsd).toFixed(6)),
            saved_cost_usd: Number((Number(existing.saved_cost_usd ?? 0) + savedCostUsd).toFixed(6)),
            updated_at: new Date().toISOString(),
          })
          .eq('date', today)
          .eq('feature_module', feature)
          .eq('model_id', modelId)
          .eq('source_channel', channel)
      } else {
        await supabase.from('ai_feature_usage_daily').insert({
          date: today,
          feature_module: feature,
          model_id: modelId,
          source_channel: channel,
          request_count: 1,
          input_tokens: inTokens,
          output_tokens: outTokens,
          total_cost_usd: Number(totalCostUsd.toFixed(6)),
          saved_cost_usd: Number(savedCostUsd.toFixed(6)),
          updated_at: new Date().toISOString(),
        })
      }
    } catch (tblErr) {
      // 若尚未執行遷移 156 或表暫時不可用，降級忽略
      console.warn('[trackAiUsage] feature_usage error (non-fatal):', tblErr)
    }

    // 2. 雙寫到既有的 ai_source_usage_daily，保證全平台總覽及相容視圖可直接匯總
    try {
      // 為了適應 ai_source_usage_daily 的 check constraint ('cliproxy','freellm','groq','direct')
      const legacyChannel = (channel === 'cliproxy' || channel === 'freellm' || channel === 'groq') ? channel : 'direct'
      const { data: srcRow } = await supabase
        .from('ai_source_usage_daily')
        .select('message_count, input_tokens, output_tokens, total_cost_usd, saved_cost_usd')
        .eq('date', today)
        .eq('source_channel', legacyChannel)
        .eq('model_id', modelId)
        .maybeSingle()

      if (srcRow) {
        await supabase
          .from('ai_source_usage_daily')
          .update({
            message_count: (srcRow.message_count ?? 0) + 1,
            input_tokens: Number(srcRow.input_tokens ?? 0) + inTokens,
            output_tokens: Number(srcRow.output_tokens ?? 0) + outTokens,
            total_cost_usd: Number((Number(srcRow.total_cost_usd ?? 0) + totalCostUsd).toFixed(6)),
            saved_cost_usd: Number((Number(srcRow.saved_cost_usd ?? 0) + savedCostUsd).toFixed(6)),
          })
          .eq('date', today)
          .eq('source_channel', legacyChannel)
          .eq('model_id', modelId)
      } else {
        await supabase.from('ai_source_usage_daily').insert({
          date: today,
          source_channel: legacyChannel,
          model_id: modelId,
          message_count: 1,
          input_tokens: inTokens,
          output_tokens: outTokens,
          total_cost_usd: Number(totalCostUsd.toFixed(6)),
          saved_cost_usd: Number(savedCostUsd.toFixed(6)),
        })
      }
    } catch {
      // non-blocking
    }
  } catch (err) {
    console.warn('[trackAiUsage] unexpected error:', err)
  }
}
