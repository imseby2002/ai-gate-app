import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { history } = await req.json()
  if (!history?.length) return NextResponse.json({ summary: '' })

  const conversation = history
    .map((m: { role: string; content: string }) =>
      `${m.role === 'user' ? '客戶' : 'AI客服'}：${m.content}`)
    .join('\n')

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-20241022'),
    maxOutputTokens: 300,
    messages: [{
      role: 'user',
      content: `請用繁體中文摘要以下客服對話，格式如下：
【問題】（客戶主要問題，一句話）
【狀態】（已解決 / 待處理 / 已升級人工）
【重點】（2-3個要點，條列式）

對話內容：
${conversation}`,
    }],
  })

  return NextResponse.json({ summary: text })
}
