import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { copy, companyName, topic, feedback } = await req.json()
  if (!copy) return NextResponse.json({ error: 'copy required' }, { status: 400 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const feedbackSection = feedback
    ? `\n\n上一版本的修改意見：${feedback}\n請根據以上意見調整腳本。`
    : ''

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system: '你是一位資深影片導演兼腳本撰寫人，擅長為品牌製作30秒行銷短片的分鏡腳本。',
    messages: [
      {
        role: 'user',
        content: `請根據以下行銷文案，撰寫一個 30 秒行銷影片的詳細分鏡腳本：

公司名稱：${companyName ?? '品牌'}
主題：${topic ?? '品牌推廣'}

行銷文案：
${copy}${feedbackSection}

腳本格式要求：
- 分為 4-5 個場景
- 每個場景標明時間軸（秒數）
- 包含：畫面描述、旁白台詞、背景音樂建議
- 最後場景必須顯示品牌 Logo 與聯絡方式
- 畫面描述要具體（可指導影片生成 AI）

請嚴格按照以下格式輸出：

【影片腳本】${topic ?? '行銷短片'} 30秒版

場景一（0-Xs）：
畫面：[具體描述]
旁白：「[台詞]」
音樂：[建議]

（依此類推）`,
      },
    ],
    maxOutputTokens: 2048,
  })

  return NextResponse.json({ script: text })
}
