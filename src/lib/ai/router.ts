export type RoutingIntent =
  | 'daily'
  | 'finance'
  | 'creative'
  | 'analysis'
  | 'legal'
  | 'vision'
  | 'image-gen'
  | 'video-gen'

export const MODEL_ROUTING: Record<RoutingIntent, string> = {
  daily:     'deepseek-chat',
  finance:   'deepseek-reasoner',
  creative:  'gemini-2.0-flash',
  analysis:  'claude-opus-4-5',
  legal:     'perplexity-sonar-pro',
  vision:    'gemini-2.0-flash-vision',
  'image-gen': 'flux-1-pro',
  'video-gen': 'veo3',
}

const INTENT_KEYWORDS: Record<RoutingIntent, string[]> = {
  daily:     ['你好', '嗨', 'hello', 'hi', '幫我', '請問', '什麼是', 'what is', 'how to', '怎麼'],
  finance:   ['財務', '財報', '計算', '推理', '數學', '統計', '分析', '預算', '損益', '資產負債', 'calculate', 'math', 'finance', 'budget', 'roi'],
  creative:  ['創意', '行銷', '廣告', '文案', '品牌', '故事', '劇本', '詩', 'creative', 'marketing', 'ad copy', 'brand', 'story', 'poem'],
  analysis:  ['深度分析', '詳細分析', '深入', '研究', '比較', '評估', 'analyze', 'analysis', 'research', 'compare', 'evaluate', 'detailed'],
  legal:     ['法條', '法律', '規定', '條款', '合約', '判決', '訴訟', 'law', 'legal', 'regulation', 'contract', 'compliance', 'court'],
  vision:    ['圖片', '照片', '看這張', '分析圖', 'ocr', '文字辨識', 'image', 'photo', 'picture', 'ocr', 'recognize'],
  'image-gen': ['生成圖片', '畫一張', '創作圖', 'generate image', 'create image', 'draw', 'paint', 'illustrate'],
  'video-gen': ['生成影片', '製作影片', '動態', 'generate video', 'create video', 'animation', 'video'],
}

export function detectIntent(
  message: string,
  hasImage?: boolean,
  assistantTags?: string[]
): RoutingIntent {
  // Image always → vision
  if (hasImage) return 'vision'

  // Check assistant routing tags first
  if (assistantTags?.length) {
    if (assistantTags.some(t => ['finance', 'reasoning', 'math'].includes(t))) return 'finance'
    if (assistantTags.some(t => ['creative', 'marketing'].includes(t))) return 'creative'
    if (assistantTags.some(t => ['analysis', 'deep'].includes(t))) return 'analysis'
    if (assistantTags.some(t => ['legal', 'research', 'web'].includes(t))) return 'legal'
    if (assistantTags.some(t => ['image-gen'].includes(t))) return 'image-gen'
    if (assistantTags.some(t => ['video-gen'].includes(t))) return 'video-gen'
  }

  const lowerMsg = message.toLowerCase()

  // Score each intent
  let bestIntent: RoutingIntent = 'daily'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [RoutingIntent, string[]][]) {
    const score = keywords.filter(kw => lowerMsg.includes(kw)).length
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  return bestIntent
}

export function resolveModel(
  intent: RoutingIntent,
  userOverride?: string | null
): string {
  if (userOverride) return userOverride
  return MODEL_ROUTING[intent]
}

export function getProviderFromModel(modelId: string): string {
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('gemini') || modelId.startsWith('google')) return 'google'
  if (modelId.startsWith('claude')) return 'anthropic'
  if (modelId.startsWith('perplexity')) return 'perplexity'
  if (modelId.startsWith('flux') || modelId.startsWith('nano')) return 'fal'
  if (modelId.startsWith('veo')) return 'veo'
  if (modelId.startsWith('kling')) return 'kling'
  return 'deepseek'
}

export function isImageModel(modelId: string): boolean {
  const imageModels = ['flux-1-pro', 'nano-banana']
  return imageModels.includes(modelId)
}

export function isVideoModel(modelId: string): boolean {
  const videoModels = ['veo3', 'kling-v2']
  return videoModels.includes(modelId)
}

export function isTextModel(modelId: string): boolean {
  return !isImageModel(modelId) && !isVideoModel(modelId)
}

// Cost calculation
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs: Record<string, { in: number; out: number }> = {
    'deepseek-chat':           { in: 0.00014,  out: 0.00028  },
    'deepseek-reasoner':       { in: 0.00055,  out: 0.00219  },
    'gemini-2.0-flash':        { in: 0.000075, out: 0.0003   },
    'gemini-2.0-flash-thinking': { in: 0.000075, out: 0.0003 },
    'gemini-2.0-flash-vision': { in: 0.00125,  out: 0.00375  },
    'claude-opus-4-5':         { in: 0.015,    out: 0.075    },
    'claude-sonnet-4-5':       { in: 0.003,    out: 0.015    },
    'perplexity-sonar-pro':    { in: 0.001,    out: 0.001    },
  }

  const c = costs[modelId]
  if (!c) return 0
  return (inputTokens / 1000) * c.in + (outputTokens / 1000) * c.out
}
