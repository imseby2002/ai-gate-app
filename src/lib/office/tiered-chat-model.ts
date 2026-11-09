import type { LanguageModel } from 'ai'
import { FALLBACK_CHAINS, attemptModelId, createChainModel, type ChainName } from '@/lib/ai/proxy-fallback'
import type { SourceChannel } from '@/lib/ai/token-cost-tracker'

export type ModelTier = 'vision' | 'complex' | 'daily'

export interface TierDecision {
  tier: ModelTier
  modelId: string
  sourceChannel: SourceChannel
  reason: string
  model: LanguageModel
}

export interface TierOptions {
  /** 是否包含圖片 / Base64 / 照片 URL */
  hasImage?: boolean
  /** 使用者提問或訊息文字 */
  message?: string
  /** 外部強制指定難度（例如由業務邏輯判定） */
  forceTier?: ModelTier
  /** 特徵關鍵字擴充 */
  additionalComplexKeywords?: string[]
}

// 判定高難度／深度推理／交叉比對關鍵字
const DEFAULT_COMPLEX_KEYWORDS = [
  '交叉分析', '交叉檢核', '合理性分析', '加料排擠', '舞弊', '作廢', '私購', '幽靈原料',
  '對帳', '推算', '利潤分析', '損益', '配方設計', '研發大腦', '風味架構', '香氣平衡',
  '合約審核', '條款修改', '租約談判', '特許加盟', '勞動法規', '法規遵循', '電路圖',
  '機電工程', '冷啟動推導', '十層根因', '根因穿透', 'root cause', '電阻量測', '凸輪開關'
]

/**
 * 門市與辦公室 (Office) 各部門統一階梯式模型選擇器（免費優先，依費用由低到高自動遞補）
 * 1. 📸 照片 / 視覺辨識：CLIProxy Gemini → Claude Haiku 5.5 → Sonnet 5.5（vision 鏈）
 * 2. 🔴 高難度 / 深度推理 / 配方設計 / 合約條款：CLIProxy gemini-2.5-pro / gpt-5.5 / kimi-k2.5 → Haiku 5.5 → Sonnet 5.5（content 鏈）
 * 3. 🟢 日常問答 / 規章查找：FreeLLM / CLIProxy 輕量模型 → Haiku 5.5 → DeepSeek（extraction 鏈）
 * 回傳的 model 是鏈式模型；實際生成後 modelId / sourceChannel 會更新為實際使用的模型，供呼叫端記錄用量。
 */
export function getOfficeTieredModel(opts: TierOptions): TierDecision {
  const { hasImage, message = '', forceTier, additionalComplexKeywords = [] } = opts

  const complexKeywords = [...DEFAULT_COMPLEX_KEYWORDS, ...additionalComplexKeywords]
  const isComplex = forceTier === 'complex' || complexKeywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

  const tier: ModelTier = (forceTier === 'vision' || hasImage) ? 'vision' : isComplex ? 'complex' : 'daily'
  const chainName: ChainName = tier === 'vision' ? 'vision' : tier === 'complex' ? 'content' : 'extraction'
  const reason = tier === 'vision'
    ? '包含照片或多模態視覺需求，採用免費視覺模型優先'
    : tier === 'complex'
      ? '高難度/深度分析/交叉檢核，採用免費強模型優先，Claude Sonnet 5.5 保底'
      : '日常諮詢/規章與資料庫檢索，採用免費輕量模型優先'

  const decision: TierDecision = {
    tier,
    modelId: attemptModelId(FALLBACK_CHAINS[chainName][0]),
    sourceChannel: 'cliproxy',
    reason,
    model: null as unknown as LanguageModel,
  }
  decision.model = createChainModel(FALLBACK_CHAINS[chainName], attempt => {
    decision.modelId = attempt.via === 'direct' ? attempt.model : attemptModelId(attempt)
    decision.sourceChannel = attempt.via === 'cli-proxy' ? 'cliproxy' : attempt.via === 'free-llm' ? 'freellm' : attempt.provider
  })
  return decision
}
