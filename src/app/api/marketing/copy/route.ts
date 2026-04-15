import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { analysis, companyName, topic, industry, feedback } = await req.json()
  if (!analysis) return NextResponse.json({ error: 'analysis required' }, { status: 400 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const feedbackSection = feedback
    ? `\n\n上一版本的修改意見：${feedback}\n請根據以上意見調整文案。`
    : ''

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system: '你是一位頂尖的行銷文案撰寫人，擅長撰寫能引起共鳴、促進轉換的行銷文案。文案要具有感染力、清晰傳遞價值主張，並適合社群媒體發布。',
    messages: [
      {
        role: 'user',
        content: `請根據以下分析，為品牌撰寫一篇行銷文案：

公司名稱：${companyName ?? '品牌'}
行銷主題：${topic ?? '品牌推廣'}
產業：${industry ?? ''}

市場分析摘要：
${analysis}${feedbackSection}

要求：
- 文案長度：200-300字
- 包含引人注目的開頭
- 清晰的價值主張（3個核心優勢）
- 使用 emoji 增加視覺吸引力
- 以行動呼籲（CTA）結尾
- 適合 Facebook / Instagram 發布格式
- 加上 3-5 個相關 hashtag

只輸出文案本身，不需要額外說明。`,
      },
    ],
    maxOutputTokens: 1024,
  })

  return NextResponse.json({ copy: text })
}
