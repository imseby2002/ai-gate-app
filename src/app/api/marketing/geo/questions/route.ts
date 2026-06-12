/**
 * POST /api/marketing/geo/questions
 * GEO Writer 步驟1 — 問句探勘
 * haiku 依主題擴展「容易被 AI 引用」的問句，並分類意圖。
 * 步驟1 MVP：不建表、不算機會分數，純回傳問句陣列。
 *
 * Body: { topic: string; exclusiveFacts?: string; locale?: string }
 * Resp: { questions: { question: string; intent: 'info'|'local'|'compare'|'transact' }[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const SYSTEM = `你是 GEO（Generative Engine Optimization）內容策略專家，專長讓內容容易被 AI 引擎（ChatGPT / Perplexity / Google AIO / Gemini / Claude）引用。
依使用者主題，擴展 8–12 個「真實使用者會向 AI 提問」的問句，優先選擇商業意圖高、競爭少的長尾問句。

每個問句標註意圖：
- info：純資訊查詢
- local：在地/地區性需求（含地名、就近服務）
- compare：比較、推薦、選哪個
- transact：接近成交（價格、怎麼預約、找誰辦）

只回傳純 JSON，格式：
{ "questions": [ { "question": "問句", "intent": "info|local|compare|transact" } ] }`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const { topic, exclusiveFacts, locale } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: '請輸入主題' }, { status: 400 })
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptText = `${SYSTEM}${outputLangInstruction(locale)}

【主題】
${topic}
${exclusiveFacts?.trim() ? `\n【獨家資訊／可用素材】\n${exclusiveFacts}` : ''}`

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      messages: [{ role: 'user', content: promptText }],
      maxOutputTokens: 1500,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('[geo/questions]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
