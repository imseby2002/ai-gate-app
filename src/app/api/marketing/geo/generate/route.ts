/**
 * POST /api/marketing/geo/generate
 * GEO Writer 步驟1/2 — 產出文章
 * sonnet 依勾選問句 + 獨家資訊，產出「容易被 AI 引用」的文章（Markdown）+ JSON-LD。
 * 必含 6 要素：開頭 40–60 字直接回答、H2/H3 問句標題、列點/表格/FAQ、
 * JSON-LD（FAQPage+Article+Organization）、E-E-A-T 署名、放行 AI 爬蟲（提示）。
 * 步驟2：讀取專案/問句，寫入 geo_articles，並將勾選問句標記 status=written。
 *
 * 防內容農場：
 *   - 機制2 強制獨家層：project.exclusive_facts 未填則拒絕產出（回 422 code=no_exclusive）
 *   - 機制3 產出查重：與專案內既有文章 question_ids 重疊度過高則擋下（回 409 code=duplicate）
 *
 * Body: { projectId, questionIds: string[], clusterId?, locale? }
 * Resp: { articleId, title, body_md, json_ld }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'
import { enrichJsonLd, type Material } from '@/lib/geo/schema'

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

  const { projectId, questionIds, clusterId, locale } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })
  const ids: string[] = Array.isArray(questionIds) ? questionIds.filter(Boolean) : []
  if (ids.length === 0) return NextResponse.json({ error: '請至少勾選一個問句' }, { status: 400 })

  // 讀專案（RLS 保證擁有者）
  const { data: project, error: pErr } = await supabase
    .from('geo_projects')
    .select('id, seed_topic, exclusive_facts, author')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  // 防農場機制2：強制獨家層
  if (!project.exclusive_facts?.trim()) {
    return NextResponse.json(
      { error: '請先在「獨家資訊」填入真實報價／在地案例／數據，避免產出空泛內容', code: 'no_exclusive' },
      { status: 422 },
    )
  }

  // 防農場機制3：查重 — 與既有文章問句重疊度過高則擋下
  const { data: existing } = await supabase
    .from('geo_articles')
    .select('id, title, question_ids')
    .eq('project_id', projectId)
  const pickedSet = new Set(ids)
  for (const a of existing ?? []) {
    const prev: string[] = a.question_ids ?? []
    if (prev.length === 0) continue
    const overlap = prev.filter(id => pickedSet.has(id)).length
    const jaccard = overlap / new Set([...prev, ...ids]).size
    if (jaccard >= 0.6) {
      return NextResponse.json(
        { error: `與既有文章「${a.title}」題材高度重複，請合併或改選不同問句`, code: 'duplicate', duplicateOf: a.id },
        { status: 409 },
      )
    }
  }

  // 讀勾選問句
  const { data: qRows, error: qErr } = await supabase
    .from('geo_questions')
    .select('id, question')
    .eq('project_id', projectId)
    .in('id', ids)
  if (qErr || !qRows || qRows.length === 0) {
    return NextResponse.json({ error: '找不到勾選的問句' }, { status: 404 })
  }

  // 素材庫（商家檔案 / 作者 / 獨家事實）
  const { data: material } = await supabase
    .from('geo_material')
    .select('business, authors, facts')
    .eq('user_id', user.id)
    .single()
  const mat: Material = {
    business: material?.business ?? null,
    authors: material?.authors ?? [],
    facts: material?.facts ?? [],
  }

  const topic = project.seed_topic
  const exclusiveFacts = project.exclusive_facts ?? ''
  const author = (project.author ?? '').trim() || mat.authors?.[0]?.name || ''
  const questions = qRows.map(r => r.question)

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptText = `${SYSTEM}${outputLangInstruction(locale)}

【文章主題】
${topic}

【必須回答的問句（每題一個 H2/H3 小標）】
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${exclusiveFacts.trim() ? `【獨家資訊（務必融入，提升可信度與被引用率）】\n${exclusiveFacts}\n` : ''}
【署名（E-E-A-T author）】
${author.trim() || 'im-tourist 峴港在地團隊'}

請依輸出規則產出文章與 JSON-LD。`

  let body_md = ''
  let json_ld: unknown = null
  let title = topic
  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      messages: [{ role: 'user', content: promptText }],
      maxOutputTokens: 4000,
    })

    const bodyMatch = text.match(/===ARTICLE_START===([\s\S]*?)===ARTICLE_END===/)
    const jsonldMatch = text.match(/===JSONLD_START===([\s\S]*?)===JSONLD_END===/)

    body_md = bodyMatch ? bodyMatch[1].trim() : text.trim()
    if (jsonldMatch) {
      const raw = jsonldMatch[1].replace(/```json|```/g, '').trim()
      try { json_ld = JSON.parse(raw) } catch { json_ld = null }
    }
    // 用素材庫的真實商家/作者注入 LocalBusiness + Person（不靠 LLM 編造）
    if (mat.business || (mat.authors && mat.authors.length > 0)) {
      json_ld = enrichJsonLd(json_ld, mat)
    }
    const titleMatch = body_md.match(/^#\s+(.+)$/m)
    title = titleMatch ? titleMatch[1].trim() : topic
  } catch (err) {
    console.error('[geo/generate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const dedup_hash = createHash('sha256').update(body_md).digest('hex').slice(0, 32)

  // 寫入文章
  const { data: article, error: aErr } = await supabase
    .from('geo_articles')
    .insert({
      project_id: projectId,
      cluster_id: clusterId ?? null,
      title,
      body_md,
      json_ld: json_ld ?? null,
      question_ids: qRows.map(r => r.id),
      exclusive_used: !!exclusiveFacts.trim(),
      dedup_hash,
      status: 'draft',
    })
    .select('id')
    .single()

  if (aErr || !article) {
    console.error('[geo/generate] article insert', aErr)
    return NextResponse.json({ error: '寫入文章失敗' }, { status: 500 })
  }

  // 勾選問句標記為已撰寫
  await supabase.from('geo_questions').update({ status: 'written' }).in('id', qRows.map(r => r.id))

  return NextResponse.json({ articleId: article.id, title, body_md, json_ld })
}
