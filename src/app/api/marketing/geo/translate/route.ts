/**
 * POST /api/marketing/geo/translate
 * GEO Writer 步驟6 — 多語版本（如越南文版）
 * sonnet 將既有文章翻成目標語言（保留 Markdown 結構與被引用 6 要素），
 * 並在地化 JSON-LD 的人類可讀文字；存為同專案的新 geo_article（draft）。
 *
 * Body: { articleId: string; targetLocale: 'zh-TW' | 'en' | 'vi' }
 * Resp: { articleId, title, body_md, json_ld }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const { articleId, targetLocale } = await req.json()
  if (!articleId || !targetLocale) {
    return NextResponse.json({ error: '缺少 articleId 或 targetLocale' }, { status: 400 })
  }

  const { data: src } = await supabase
    .from('geo_articles')
    .select('id, project_id, cluster_id, body_md, json_ld, question_ids, exclusive_used')
    .eq('id', articleId)
    .single()
  if (!src) return NextResponse.json({ error: '找不到原文章' }, { status: 404 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptText = `你是專業在地化譯者。請將以下 GEO 文章與其 JSON-LD 翻譯成目標語言，務必：
- 保留所有 Markdown 結構（H1/H2/H3、清單、表格、FAQ），保留「開頭直接回答」段。
- 翻譯要在地、自然，符合當地用語，而非逐字直譯。
- JSON-LD 的 key 維持英文（schema.org 標準），只翻人類可讀的值。
${outputLangInstruction(targetLocale)}

輸出規則：
- 文章用 ===ARTICLE_START=== 與 ===ARTICLE_END=== 包住
- JSON-LD 用 ===JSONLD_START=== 與 ===JSONLD_END=== 包住（合法 JSON）

【原文章 Markdown】
${src.body_md}

【原 JSON-LD】
${src.json_ld ? (typeof src.json_ld === 'string' ? src.json_ld : JSON.stringify(src.json_ld)) : '（無）'}`

  let body_md = ''
  let json_ld: unknown = null
  let title = ''
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
    const titleMatch = body_md.match(/^#\s+(.+)$/m)
    title = titleMatch ? titleMatch[1].trim() : body_md.slice(0, 60)
  } catch (err) {
    console.error('[geo/translate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const dedup_hash = createHash('sha256').update(body_md).digest('hex').slice(0, 32)

  const { data: article, error: aErr } = await supabase
    .from('geo_articles')
    .insert({
      project_id: src.project_id,
      cluster_id: src.cluster_id,
      title,
      body_md,
      json_ld: json_ld ?? null,
      question_ids: src.question_ids ?? [],
      exclusive_used: src.exclusive_used ?? false,
      dedup_hash,
      status: 'draft',
    })
    .select('id')
    .single()
  if (aErr || !article) {
    console.error('[geo/translate] insert', aErr)
    return NextResponse.json({ error: '寫入譯文失敗' }, { status: 500 })
  }

  return NextResponse.json({ articleId: article.id, title, body_md, json_ld })
}
