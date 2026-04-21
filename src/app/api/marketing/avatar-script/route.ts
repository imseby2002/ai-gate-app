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

  const { campaignId, count = 1, duration = 60, style = '專業親切' } = await req.json()
  if (!campaignId) return NextResponse.json({ error: '缺少 campaignId' }, { status: 400 })

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('unit_data')
    .eq('id', campaignId)
    .single()

  const unitData = (campaign?.unit_data ?? {}) as Record<string, unknown>
  const companyData  = (unitData[2] as { name?: string; industry?: string; products?: string }) ?? {}
  const analysisData = (unitData[3] as { summary?: string }) ?? {}
  const copyData     = (unitData[4] as { copies?: Array<{ title?: string; body?: string }> }) ?? {}

  const copySample = copyData.copies?.slice(0, 2)
    .map((c, i) => `【文案${i+1}】\n${c.title ?? ''}\n${c.body ?? ''}`)
    .join('\n\n') ?? ''

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    messages: [{
      role: 'user',
      content: `你是一位專業的行銷主播腳本撰寫師。請為以下品牌撰寫 ${count} 份 AI 虛擬主播（HeyGen）口播腳本。

品牌資訊：
- 公司名稱：${companyData.name ?? '未知'}
- 行業：${companyData.industry ?? '未知'}
- 產品/服務：${companyData.products ?? '未知'}

市場分析摘要：
${analysisData.summary ?? '無'}

現有行銷文案（參考）：
${copySample || '無'}

腳本要求：
- 每份腳本約 ${duration} 秒口播（中文約 ${Math.round(duration * 4.5)} 字，英文約 ${Math.round(duration * 2.5)} 字）
- 風格：${style}
- 語氣自然流暢，適合真人主播朗讀
- 開場有吸引力，結尾有行動呼籲（CTA）
- 避免生硬的廣告語氣

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
