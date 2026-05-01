/**
 * POST /api/marketing/avatar-script
 * 用 Claude 生成 HeyGen 主播腳本
 *
 * Body: {
 *   campaignId: string
 *   count?: number          // 生成幾份腳本（預設 1）
 *   duration?: number       // 目標秒數（預設 60）
 *   style?: string          // 風格描述
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    campaignId,
    count = 1,
    duration = 60,
    style = '專業親切',
    // Inline data — passed directly from Unit 4 (no Supabase lookup needed)
    companyData:       inlineCompany,
    analysisData:      inlineAnalysis,
    collectedSummary:  inlineCollected,
    existingCopies:    inlineCopies,
  } = body

  let companyName      = '未知'
  let companyIndustry  = '未知'
  let companyProducts  = '未知'
  let companyAudience  = ''
  let companyTone      = ''
  let analysisSummary  = '無'
  let collectedSummary = ''
  let copySample       = ''

  if (inlineCompany) {
    // Use data passed directly from Unit 4
    companyName     = inlineCompany.companyName ?? inlineCompany.name ?? '未知'
    companyIndustry = inlineCompany.industry ?? '未知'
    companyProducts = inlineCompany.products ?? '未知'
    companyAudience = inlineCompany.targetAudience ?? ''
    companyTone     = inlineCompany.brandTone ?? ''
    if (inlineAnalysis?.results) {
      analysisSummary = Object.values(inlineAnalysis.results as Record<string, string>).join('\n').slice(0, 2000)
    } else if (inlineAnalysis?.summary) {
      analysisSummary = inlineAnalysis.summary
    }
    collectedSummary = inlineCollected ?? ''
    if (inlineCopies && typeof inlineCopies === 'object') {
      const keys = Object.keys(inlineCopies).slice(0, 2)
      copySample = keys.map((k: string) => inlineCopies[k] ? `【${k}】\n${inlineCopies[k]}` : '').filter(Boolean).join('\n\n')
    }
  } else if (campaignId) {
    // Fall back to Supabase lookup
    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('unit_data')
      .eq('id', campaignId)
      .single()

    const unitData = (campaign?.unit_data ?? {}) as Record<string, unknown>

    const companyRaw = (unitData[2] as Record<string, string> | null) ?? {}
    companyName     = companyRaw.companyName ?? companyRaw.name ?? '未知'
    companyIndustry = companyRaw.industry ?? '未知'
    companyProducts = companyRaw.products ?? companyRaw['主要產品/服務'] ?? '未知'
    companyAudience = companyRaw.targetAudience ?? ''
    companyTone     = companyRaw.brandTone ?? ''

    const analysisRaw = (unitData[3] as { summary?: string; results?: Record<string, string> } | null) ?? {}
    analysisSummary = analysisRaw.summary
      ?? (analysisRaw.results ? Object.values(analysisRaw.results).join('\n').slice(0, 2000) : '無')

    const unit1Raw = (unitData[1] as { summary?: string; collectedSummary?: string } | null) ?? {}
    collectedSummary = unit1Raw.summary ?? unit1Raw.collectedSummary ?? ''

    const copyRaw = (unitData[4] as { results?: Record<string, string>; types?: string[] } | null) ?? {}
    const copyResults = copyRaw.results ?? {}
    if (copyResults.anchor_script) {
      copySample = `【Unit 4 主播文案（請以此為基礎延伸）】\n${copyResults.anchor_script}`
    } else {
      const sampleKeys = (copyRaw.types ?? Object.keys(copyResults)).slice(0, 2)
      copySample = sampleKeys.map(k => copyResults[k] ? `【${k}】\n${copyResults[k]}` : '').filter(Boolean).join('\n\n')
    }
  } else {
    return NextResponse.json({ error: '請提供 campaignId 或 companyData' }, { status: 400 })
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    messages: [{
      role: 'user',
      content: `你是一位專業的行銷主播腳本撰寫師。請為以下品牌撰寫 ${count} 份 AI 虛擬主播（HeyGen）口播腳本。

【品牌資訊】
- 公司名稱：${companyName}
- 行業：${companyIndustry}
- 產品/服務：${companyProducts}
${companyAudience ? `- 目標客群：${companyAudience}` : ''}
${companyTone ? `- 品牌語調：${companyTone}` : ''}

【市場調查摘要（Unit 1）】
${collectedSummary || '無'}

【市場分析摘要（Unit 3）】
${analysisSummary}

【現有行銷文案（Unit 4，請參考語氣與重點）】
${copySample || '無'}

【腳本要求】
- 每份腳本約 ${duration} 秒口播（中文約 ${Math.round(duration * 4.5)} 字）
- 風格：${style}
- 語氣口語自然流暢，適合真人或AI虛擬主播朗讀
- 結構：開場招呼 → 引入主題 → 3-5個核心重點（自然過渡） → 行動呼籲（CTA） → 結語
- 全程使用口語，避免書面語，多用短句，易於斷句停頓
- 開場有吸引力，結尾有明確行動呼籲

請嚴格按照以下格式輸出（不要有其他說明文字）：

===【腳本 1】===
（腳本內容）

===【腳本 2】===
（腳本內容）

以此類推。`,
    }],
  })

  // 解析腳本
  const scripts: string[] = []
  const blocks = text.split(/===【腳本\s*\d+】===/)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (trimmed) scripts.push(trimmed)
  }

  return NextResponse.json({ scripts: scripts.slice(0, count) })
}
