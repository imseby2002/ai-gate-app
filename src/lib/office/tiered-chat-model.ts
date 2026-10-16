import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
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
 * 門市與辦公室 (Office) 各部門統一階梯式模型選擇器
 * 1. 📸 照片 / 圖片 / 視覺辨識：Gemini 2.5 Flash (快速、低成本、強大多模態)
 * 2. 🔴 高難度 / 深度推理 / 交叉檢核 / 配方設計 / 合約條款：Claude Sonnet 4.5 / 4.6
 * 3. 🟢 日常問答 / 資料庫檢索 / 規章查找 / 常規引導：DeepSeek-Chat (高性價比、極速)
 */
export function getOfficeTieredModel(opts: TierOptions): TierDecision {
  const { hasImage, message = '', forceTier, additionalComplexKeywords = [] } = opts

  // 1. 照片 / 圖片優先 -> Gemini 2.5 Flash
  if (forceTier === 'vision' || hasImage) {
    const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (googleApiKey) {
      const google = createGoogleGenerativeAI({ apiKey: googleApiKey })
      return {
        tier: 'vision',
        modelId: 'gemini-2.5-flash',
        sourceChannel: 'google',
        reason: '包含照片或多模態視覺需求，採用 Gemini 2.5 Flash',
        model: google('gemini-2.5-flash'),
      }
    }
  }

  // 2. 判斷是否為高難度
  const complexKeywords = [...DEFAULT_COMPLEX_KEYWORDS, ...additionalComplexKeywords]
  const isComplex = forceTier === 'complex' || complexKeywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

  if (isComplex && process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return {
      tier: 'complex',
      modelId: 'claude-sonnet-4-5',
      sourceChannel: 'anthropic',
      reason: '高難度/深度分析/交叉檢核，採用 Claude Sonnet 4.5',
      model: anthropic('claude-sonnet-4-5'),
    }
  }

  // 3. 日常對話 / 資料庫檢索 / 常規問答 -> 優先使用 DeepSeek-Chat
  if (process.env.DEEPSEEK_API_KEY) {
    const deepseek = createOpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    })
    return {
      tier: 'daily',
      modelId: 'deepseek-chat',
      sourceChannel: 'deepseek',
      reason: '日常諮詢/規章與資料庫檢索，採用 DeepSeek-Chat',
      model: deepseek.chat('deepseek-chat'),
    }
  }

  // Fallbacks: 如果缺少 DeepSeek Key，嘗試使用 Gemini Flash 或 Anthropic
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (googleApiKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleApiKey })
    return {
      tier: 'daily',
      modelId: 'gemini-2.5-flash',
      sourceChannel: 'google',
      reason: 'DeepSeek 未配置，備援採用 Gemini 2.5 Flash',
      model: google('gemini-2.5-flash'),
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return {
      tier: 'complex',
      modelId: 'claude-sonnet-4-5',
      sourceChannel: 'anthropic',
      reason: '備援採用 Claude Sonnet 4.5',
      model: anthropic('claude-sonnet-4-5'),
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return {
      tier: 'daily',
      modelId: 'gpt-4o-mini',
      sourceChannel: 'openai',
      reason: '備援採用 GPT-4o Mini',
      model: openai('gpt-4o-mini'),
    }
  }

  throw new Error('未設定任何可用的 AI API 金鑰 (DEEPSEEK_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY)')
}
