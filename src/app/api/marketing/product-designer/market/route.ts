/**
 * POST /api/marketing/product-designer/market
 * Phase 3 — Market Analyst
 * Generates market analysis: positioning, competitors, buyer personas
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const MARKET_PROMPT = `你是市場研究分析師。根據產品資訊進行深度市場分析。

回傳純 JSON：
{
  "core_value": {
    "statement": "核心價值主張一句話",
    "differentiators": ["差異化點1","差異化點2","差異化點3"],
    "proof_points": ["佐證1","佐證2"]
  },
  "market_positioning": {
    "category": "市場類別",
    "price_tier": "價格區間定位（高/中高/中/平價）",
    "positioning_statement": "定位宣言",
    "market_size_estimate": "市場規模預估",
    "growth_trend": "市場趨勢"
  },
  "competitors": [
    {
      "name": "競品名稱",
      "strengths": ["優勢1","優勢2"],
      "weaknesses": ["弱點1"],
      "our_advantage": "我方優勢"
    }
  ],
  "buyer_personas": [
    {
      "name": "角色名稱",
      "age_range": "年齡範圍",
      "occupation": "職業",
      "pain_points": ["痛點1","痛點2"],
      "motivations": ["動機1","動機2"],
      "search_keywords": ["關鍵字1","關鍵字2","關鍵字3"],
      "preferred_platforms": ["平台1","平台2"],
      "buying_trigger": "購買觸發點"
    }
  ],
  "regional_insights": {
    "primary_market": "主要市場",
    "trends": ["趨勢1","趨勢2"],
    "seasonal_factors": ["季節因素"],
    "cultural_notes": "文化注意事項"
  }
}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan: userPlan, features } = await getMarketingEntitlements(supabase, user.id)
  if (features.productDesigner === 'none') {
    return NextResponse.json({ error: '目前方案未開放 AI 產品行銷設計師，請升級至 PRO 以上', plan: userPlan }, { status: 403 })
  }

  const body = await req.json()
  const { productName, description, industry, targetAudience, productAnalysis, selectedRoute, locale } = body

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  const ctx = `產品名稱：${productName}
產業：${industry ?? '未提供'}
描述：${description ?? '未提供'}
目標客群：${targetAudience ?? '未提供'}
${productAnalysis ? `產品分析：${JSON.stringify(productAnalysis)}` : ''}
${selectedRoute ? `選定路線：${selectedRoute.route_name} — ${selectedRoute.headline}` : ''}`

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      messages: [{
        role: 'user',
        content: `${MARKET_PROMPT}${outputLangInstruction(locale)}\n\n【產品資料】\n${ctx}`,
      }],
      maxOutputTokens: 3000,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
