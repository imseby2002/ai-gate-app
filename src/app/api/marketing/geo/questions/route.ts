/**
 * POST /api/marketing/geo/questions
 * GEO Writer 步驟1/2 — 問句探勘 + 建立專案
 * haiku 依主題擴展「容易被 AI 引用」的問句並分類意圖；
 * 步驟2：同時建立 geo_project 並寫入 geo_questions（status=suggested）。
 *
 * Body: { topic: string; exclusiveFacts?: string; author?: string; locale?: string }
 * Resp: { projectId, questions: { id, question, intent }[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

type Intent = 'info' | 'local' | 'compare' | 'transact'
const INTENTS: Intent[] = ['info', 'local', 'compare', 'transact']

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

  const { topic, exclusiveFacts, author, targetDomain, locale } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: '請輸入主題' }, { status: 400 })
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptText = `${SYSTEM}${outputLangInstruction(locale)}

【主題】
${topic}
${exclusiveFacts?.trim() ? `\n【獨家資訊／可用素材】\n${exclusiveFacts}` : ''}`

  let parsed: { question: string; intent: Intent }[]
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      messages: [{ role: 'user', content: promptText }],
      maxOutputTokens: 1500,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })

    const raw = JSON.parse(jsonMatch[0])
    parsed = (raw.questions ?? [])
      .filter((q: { question?: string }) => q?.question?.trim())
      .map((q: { question: string; intent?: string }) => ({
        question: q.question.trim(),
        intent: INTENTS.includes(q.intent as Intent) ? (q.intent as Intent) : 'info',
      }))
  } catch (err) {
    console.error('[geo/questions]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: 'AI 未產出問句' }, { status: 500 })
  }

  // 建立專案
  const { data: project, error: projErr } = await supabase
    .from('geo_projects')
    .insert({
      user_id: user.id,
      seed_topic: topic,
      locale: locale ?? 'zh-TW',
      exclusive_facts: exclusiveFacts?.trim() || null,
      author: author?.trim() || null,
      target_domain: targetDomain?.trim() || null,
    })
    .select('id')
    .single()

  if (projErr || !project) {
    console.error('[geo/questions] project insert', projErr)
    return NextResponse.json({ error: '建立專案失敗' }, { status: 500 })
  }

  // 寫入問句
  const { data: rows, error: qErr } = await supabase
    .from('geo_questions')
    .insert(parsed.map(p => ({
      project_id: project.id,
      question: p.question,
      intent: p.intent,
      status: 'suggested',
    })))
    .select('id, question, intent')

  if (qErr || !rows) {
    console.error('[geo/questions] questions insert', qErr)
    return NextResponse.json({ error: '寫入問句失敗' }, { status: 500 })
  }

  return NextResponse.json({ projectId: project.id, questions: rows })
}
