/**
 * POST /api/marketing/geo/generate
 * GEO Writer 步驟1 — 產出文章
 * sonnet 依勾選問句 + 獨家資訊，產出一篇「容易被 AI 引用」的文章（Markdown）+ JSON-LD。
 * 必含 6 要素：開頭 40–60 字直接回答、H2/H3 問句標題、列點/表格/FAQ、
 * JSON-LD（FAQPage+Article+Organization）、E-E-A-T 署名、放行 AI 爬蟲（提示）。
 * 步驟1 MVP：不建表，直接回傳供前端複製。
 *
 * Body: { topic, questions: string[], exclusiveFacts?, author?, locale? }
 * Resp: { title, body_md, json_ld }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 120

const SYSTEM = `你是 GEO（Generative Engine Optimization）內容寫手，目標是寫出最容易被 AI 引擎（ChatGPT / Perplexity / Google AIO / Gemini / Claude）直接引用的文章。

必須做到「被引用 6 要素」：
1. 開頭 40–60 字「直接回答」核心問題（前置摘要，AI 最常擷取這段）
2. 用 H2/H3「問句」當小標題，逐題回答勾選的問句
3. 大量使用列點、表格、FAQ 區塊，讓 AI 容易結構化擷取
4. 內容必須包含至少一個 Markdown 表格與一個 FAQ 區塊
5. 體現 E-E-A-T：具體在地經驗、可信細節、署名
6. 善用「獨家資訊」中的真實報價／在地案例／數據，避免空泛內容農場式寫法

輸出規則（嚴格遵守）：
- 先輸出文章 Markdown，使用分隔標記 ===ARTICLE_START=== 與 ===ARTICLE_END=== 包住
- 再輸出 JSON-LD，使用 ===JSONLD_START=== 與 ===JSONLD_END=== 包住
- JSON-LD 必須是合法 JSON，內含 @graph 陣列，包含三個物件：Article、FAQPage（mainEntity 為勾選問句的 Q&A）、Organization
- JSON-LD 的 key 維持英文（schema.org 標準），值的人類可讀文字用指定輸出語言`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const { topic, questions, exclusiveFacts, author, locale } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: '請輸入主題' }, { status: 400 })
  }
  const qs: string[] = Array.isArray(questions) ? questions.filter((q: string) => q?.trim()) : []
  if (qs.length === 0) {
    return NextResponse.json({ error: '請至少勾選一個問句' }, { status: 400 })
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptText = `${SYSTEM}${outputLangInstruction(locale)}

【文章主題】
${topic}

【必須回答的問句（每題一個 H2/H3 小標）】
${qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${exclusiveFacts?.trim() ? `【獨家資訊（務必融入，提升可信度與被引用率）】\n${exclusiveFacts}\n` : ''}
【署名（E-E-A-T author）】
${author?.trim() || 'im-tourist 峴港在地團隊'}

請依輸出規則產出文章與 JSON-LD。`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      messages: [{ role: 'user', content: promptText }],
      maxOutputTokens: 4000,
    })

    const bodyMatch = text.match(/===ARTICLE_START===([\s\S]*?)===ARTICLE_END===/)
    const jsonldMatch = text.match(/===JSONLD_START===([\s\S]*?)===JSONLD_END===/)

    const body_md = bodyMatch ? bodyMatch[1].trim() : text.trim()

    let json_ld: unknown = null
    if (jsonldMatch) {
      const raw = jsonldMatch[1].replace(/```json|```/g, '').trim()
      try { json_ld = JSON.parse(raw) } catch { json_ld = raw }
    }

    const titleMatch = body_md.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : topic

    return NextResponse.json({ title, body_md, json_ld })
  } catch (err) {
    console.error('[geo/generate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
