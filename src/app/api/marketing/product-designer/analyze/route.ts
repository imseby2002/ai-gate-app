/**
 * POST /api/marketing/product-designer/analyze
 * Phase 1 — Strategy Director
 * Analyzes product (text + optional image) and generates 3 marketing routes
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const DIRECTOR_PROMPT = `你是頂級行銷創意總監。根據提供的產品資訊，生成 3 條截然不同的行銷路線。

每條路線必須包含：
- route_name: 路線名稱（簡短有力）
- target_audience: 目標受眾（具體描述）
- headline: 主打標語（繁體中文，吸睛有力）
- subhead: 副標語（繁體中文，補充說明）
- brand_tone: 品牌語調風格
- visual_style: 視覺風格描述
- key_message: 核心訴求（痛點/渴望/恐懼/好奇）
- image_prompts: 3個英文圖片生成提示詞（描述場景/氛圍，絕對禁止在提示詞中描述產品本身）
- persuasion_angle: 說服角度

回傳純 JSON，格式：
{
  "product_analysis": {
    "name": "產品名",
    "category": "產品類別",
    "key_features": ["特點1","特點2","特點3"],
    "core_value": "核心價值一句話"
  },
  "routes": [
    { "route_name": "...", "target_audience": "...", "headline": "...", "subhead": "...", "brand_tone": "...", "visual_style": "...", "key_message": "...", "image_prompts": ["...","...","..."], "persuasion_angle": "..." },
    { ... },
    { ... }
  ]
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { productName, description, industry, targetAudience, imageBase64, imageMimeType, locale } = body

  if (!productName?.trim()) {
    return NextResponse.json({ error: '請輸入產品名稱' }, { status: 400 })
  }

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  const textCtx = `產品名稱：${productName}
產業類別：${industry ?? '未提供'}
產品描述：${description ?? '未提供'}
目標受眾：${targetAudience ?? '未提供'}`

  const promptText = `${DIRECTOR_PROMPT}${outputLangInstruction(locale)}\n\n【產品資料】\n${textCtx}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = imageBase64
    ? [{
        role: 'user',
        content: [
          { type: 'image', image: imageBase64, mimeType: imageMimeType ?? 'image/jpeg' },
          { type: 'text', text: promptText },
        ],
      }]
    : [{ role: 'user', content: promptText }]

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      messages,
      maxOutputTokens: 3000,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
