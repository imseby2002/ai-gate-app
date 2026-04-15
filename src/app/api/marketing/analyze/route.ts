import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { collectedData, companyName, companyInfo, topic, industry } = await req.json()
  if (!collectedData) return NextResponse.json({ error: 'collectedData required' }, { status: 400 })

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  const { text } = await generateText({
    model: google('gemini-1.5-flash'),
    messages: [
      {
        role: 'user',
        content: `你是一位資深行銷策略顧問。請根據以下市場調查資料，進行完整的策略分析：

公司名稱：${companyName ?? '未提供'}
行銷主題：${topic ?? '未提供'}
產業：${industry ?? '未提供'}
公司簡介：${companyInfo ?? '未提供'}

市場調查資料：
${collectedData}

請提供：

**一、SWOT 分析**
- 優勢（S）：2-3點
- 劣勢（W）：2-3點
- 機會（O）：2-3點
- 威脅（T）：2-3點

**二、目標受眾分析**
- 主要受眾描述
- 次要受眾描述
- 受眾痛點與動機

**三、行銷策略建議**
- 核心訴求方向
- 建議渠道（3個）
- 內容策略重點

**四、競爭差異化建議**
- 如何與競品區隔（2-3點）

最後，以 JSON 格式輸出關鍵指標（放在 <metrics> 標籤內）：
<metrics>
{"opportunity": 85, "competitors": 12, "audience": "25萬+潛在客戶"}
</metrics>

注意：opportunity 為 0-100 的整數分數，competitors 為整數，audience 為字串描述。`,
      },
    ],
    maxOutputTokens: 3000,
  })

  // Extract metrics
  const metricsMatch = text.match(/<metrics>([\s\S]*?)<\/metrics>/)
  let metrics = { opportunity: 80, competitors: 10, audience: '20萬+' }
  if (metricsMatch) {
    try {
      metrics = JSON.parse(metricsMatch[1].trim())
    } catch { /* use defaults */ }
  }

  const analysis = text.replace(/<metrics>[\s\S]*?<\/metrics>/, '').trim()

  return NextResponse.json({ analysis, metrics })
}
