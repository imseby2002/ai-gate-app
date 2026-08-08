/**
 * POST /api/marketing/product-designer/plan
 * Phase 2 — Content Suite Planning
 * Generates 8 cohesive marketing assets following AIDA model
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const PLANNER_PROMPT = `你是頂級行銷內容策略師。根據選定的行銷路線，依照 AIDA 模型（注意→興趣→慾望→行動）生成 8 件完整行銷素材組合。

素材組合結構（固定）：
1. main_square_white — 1:1 白背景產品主圖
2. main_square_lifestyle — 1:1 生活情境方圖
3. story_hook — 9:16 開場鉤子（抓注意力）
4. story_problem — 9:16 痛點共鳴（引發興趣）
5. story_solution — 9:16 解決方案（建立慾望）
6. story_features — 9:16 產品特點（強化信任）
7. story_trust — 9:16 社會認同/口碑（消除疑慮）
8. story_cta — 9:16 行動呼籲（促成轉換）

每件素材包含：
- id: 上述固定 id
- type: "square" 或 "story"
- ratio: "1:1" 或 "9:16"
- title: 素材標題（繁體中文）
- headline: 主標題文字（繁體中文，顯示在圖上）
- body_copy: 內文（繁體中文，2-3句）
- cta_text: 行動呼籲文字（繁體中文）
- visual_prompt_en: 英文圖片生成提示詞（描述場景氛圍，不直接描述產品本身）
- visual_summary: 視覺摘要（繁體中文，給人工審核用）
- aida_stage: AIDA 階段（A/I/D/A）

回傳純 JSON：{ "items": [ {...}, {...}, ... ] }`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan: userPlan, features } = await getMarketingEntitlements(supabase, user.id)
  if (features.productDesigner === 'none') {
    return NextResponse.json({ error: '目前方案未開放 AI 產品行銷設計師，請升級至 PRO 以上', plan: userPlan }, { status: 403 })
  }

  const body = await req.json()
  const { productAnalysis, selectedRoute, productName, locale } = body

  if (!selectedRoute) {
    return NextResponse.json({ error: '請先選擇行銷路線' }, { status: 400 })
  }

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  const ctx = `產品：${productName}
產品分析：${JSON.stringify(productAnalysis, null, 2)}
選定路線：${JSON.stringify(selectedRoute, null, 2)}`

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      messages: [{
        role: 'user',
        content: `${PLANNER_PROMPT}${outputLangInstruction(locale)}\n\n【內容】\n${ctx}`,
      }],
      maxOutputTokens: 4000,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
