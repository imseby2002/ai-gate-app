/**
 * POST /api/marketing/product-designer/strategy
 * Phase 4 — Content Strategist
 * Generates SEO topics, CTAs, AI Studio prompts, Gamma presentation prompts
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const STRATEGY_PROMPT = `你是資深內容策略師兼 SEO 專家。根據產品資訊與市場分析，制定完整內容行銷策略。

回傳純 JSON：
{
  "seo_topics": [
    {
      "title": "SEO 文章標題",
      "keyword": "主要關鍵字",
      "search_intent": "搜尋意圖（資訊型/商業型/交易型）",
      "outline": ["段落1","段落2","段落3"],
      "estimated_volume": "搜尋量預估"
    }
  ],
  "content_calendar": [
    {
      "week": 1,
      "theme": "週主題",
      "platforms": ["FB","IG","LINE"],
      "content_types": ["貼文","限時動態","短影音"],
      "key_message": "本週核心訊息"
    }
  ],
  "cta_variants": [
    { "type": "緊迫型", "text": "行動呼籲文字", "context": "適用場景" },
    { "type": "好奇型", "text": "行動呼籲文字", "context": "適用場景" },
    { "type": "社群型", "text": "行動呼籲文字", "context": "適用場景" }
  ],
  "interactive_elements": [
    { "type": "互動類型（投票/問答/挑戰賽）", "topic": "互動主題", "platform": "適用平台" }
  ],
  "ai_studio_prompts": [
    {
      "purpose": "用途描述",
      "prompt": "完整的 React+Tailwind 登陸頁面生成提示詞（英文）"
    }
  ],
  "gamma_prompts": [
    {
      "title": "簡報標題",
      "prompt": "Gamma.app 簡報生成提示詞"
    }
  ],
  "hashtag_strategy": {
    "brand_tags": ["品牌標籤1","品牌標籤2"],
    "industry_tags": ["行業標籤1","行業標籤2","行業標籤3"],
    "trending_tags": ["熱門標籤1","熱門標籤2"]
  }
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { productName, industry, productAnalysis, selectedRoute, marketAnalysis, locale } = body

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  const ctx = `產品：${productName}
產業：${industry ?? '未提供'}
產品分析：${JSON.stringify(productAnalysis ?? {})}
選定路線：${JSON.stringify(selectedRoute ?? {})}
市場分析摘要：${marketAnalysis ? `目標市場 ${marketAnalysis.market_positioning?.category ?? ''}，定位 ${marketAnalysis.market_positioning?.price_tier ?? ''}` : '未提供'}`

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      messages: [{
        role: 'user',
        content: `${STRATEGY_PROMPT}${outputLangInstruction(locale)}\n\n【資料】\n${ctx}`,
      }],
      maxOutputTokens: 4000,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
