/**
 * GET/POST /api/marketing/geo/auto-pilot
 * GEO 一鍵全自動巡航產出：
 *  - GET : 分析公司資源庫（品牌、門市、產品），主動推薦 4~6 個熱門高價值 GEO 主題
 *  - POST: 一鍵全自動巡航（選題 ➔ 探勘高價值問句 ➔ 整合公司事實 ➔ 產出權威文章與結構化資料）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { currentDataOwner, loadCompanyProfile } from '@/lib/company/profile'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'
import { enrichJsonLd, type Material } from '@/lib/geo/schema'

export const maxDuration = 120

type Intent = 'info' | 'local' | 'compare' | 'transact'

interface SuggestedTopic {
  title: string
  tag: string
  reason: string
  exclusiveFacts: string
}

const ARTICLE_SYSTEM = `你是 GEO（Generative Engine Optimization）頂級專家，目標是寫出最容易被 AI 引擎（ChatGPT / Perplexity / Google AIO / Gemini / Claude）直接引用的權威內容。

必須做到「被引用 6 要素」：
1. 開頭 40–60 字「直接回答」核心問題（前置摘要，AI 最常擷取這段）
2. 用 H2/H3「問句」當小標題，逐題深入回答問句
3. 大量使用列點、Markdown 表格、FAQ 區塊，讓 AI 容易結構化擷取
4. 內容必須包含至少一個 Markdown 表格與一個 FAQ 區塊
5. 體現 E-E-A-T：具體真實細節、在地優勢、權威署名
6. 深入融合「公司資源庫事實（真實規格、報價、門市地址）」，避免空泛套話

輸出規則（嚴格遵守）：
- 先輸出文章 Markdown，使用分隔標記 ===ARTICLE_START=== 與 ===ARTICLE_END=== 包住
- 接著輸出 Schema.org JSON-LD，使用標記 ===JSONLD_START=== 與 ===JSONLD_END=== 包住
- 嚴格只回傳這兩段標記包住的內容，不要其他開頭或結尾寒暄`

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const profile = await loadCompanyProfile(c.admin, c.ownerId)
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const companyContext = `
公司/品牌名稱：${profile.companyName || '品牌'}
產業別：${profile.industry || '餐飲/零售/服務'}
主要優勢與賣點：${profile.competitiveAdvantage || '在地經營、品質保證'}
門市地點：${(profile.branches ?? []).map(b => `${b.name}（${b.address}）`).join('、') || '全門市服務'}
產品清單：${(profile.productList ?? []).map(p => `${p.name}（NT$ ${p.price}，${p.slogan || p.category}）`).slice(0, 8).join('、')}
`

  const prompt = `根據以下公司資源庫資料，請主動構思 4 到 5 個最容易被 ChatGPT、Perplexity、Google AI Overviews 搜尋引用的「高商業價值 GEO 文章主題」。

${companyContext}

主題類型包含：
1. 【在地指南】結合門市所在城市/區域的深度消費或探店指南
2. 【選購評比】以公司主要產品為核心的推薦或選購比較指南
3. 【避坑解析】消費者常見疑問、注意事項與專業解方
4. 【性價分析】價格行情、規格比較與高CP值推薦

請只輸出純 JSON 陣列，格式如下：
[
  {
    "title": "文章主題標題",
    "tag": "在地指南 / 選購評比 / 避坑解析 / 推薦精選",
    "reason": "推薦理由（例：精準鎖定在地外送與探店搜尋流量）",
    "exclusiveFacts": "建議融入的具體事實（包含公司產品、門市地址或賣點）"
  }
]`

  try {
    const res = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      messages: [{ role: 'user', content: prompt }],
    })

    let text = res.text.trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const s = text.indexOf('['); const e = text.lastIndexOf(']')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)

    const topics: SuggestedTopic[] = JSON.parse(text)
    return NextResponse.json({ topics })
  } catch (err) {
    console.error('[geo/auto-pilot] GET suggestions error', err)
    // 降級預設主題
    const fallbackTitle = profile.companyName
      ? `${profile.companyName} 2026 最新推薦評選與完整選購指南`
      : '2026 在地精選推薦與完整選購指南'
    return NextResponse.json({
      topics: [
        {
          title: fallbackTitle,
          tag: '選購評比',
          reason: '全面建立品牌在 AI 引擎中的權威度',
          exclusiveFacts: profile.competitiveAdvantage || '',
        },
      ],
    })
  }
}

export async function POST(req: NextRequest) {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const { topic: inputTopic, locale = 'zh-TW' } = await req.json()
  const profile = await loadCompanyProfile(c.admin, c.ownerId)
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // 1. 決定主題
  let finalTopic = (inputTopic ?? '').trim()
  if (!finalTopic) {
    const firstProd = profile.productList?.[0]?.name
    const firstBranch = profile.branches?.[0]?.name
    const brand = profile.companyName || '優質品牌'
    if (firstProd) {
      finalTopic = `${brand} ${firstProd} 推薦評比與常見問題完整解析`
    } else if (firstBranch) {
      finalTopic = `${firstBranch} 探店指南、特色推薦與真實評價`
    } else {
      finalTopic = `${brand} 2026 專業推薦指南與特色解析`
    }
  }

  // 2. 彙整公司資源庫專屬事實
  const factsList: string[] = []
  if (profile.companyName) factsList.push(`品牌名稱：${profile.companyName}`)
  if (profile.competitiveAdvantage) factsList.push(`核心優勢：${profile.competitiveAdvantage}`)
  if (profile.description) factsList.push(`品牌故事：${profile.description}`)

  for (const b of (profile.branches ?? []).slice(0, 3)) {
    factsList.push(`門市【${b.name}】：地址位於 ${b.address}。${b.notes || ''}`)
  }
  for (const p of (profile.productList ?? []).slice(0, 5)) {
    factsList.push(`主打產品【${p.name}】：售價 NT$ ${p.price}。${p.slogan || ''} ${p.description || ''}`)
  }
  const exclusiveFacts = factsList.join('\n')

  const authorName = profile.companyName ? `${profile.companyName} 專業團隊` : '在地專業行銷團隊'
  const targetDomain = profile.website || ''

  // 3. 探勘 6~8 個高潛力問句
  const questionPrompt = `你是 GEO 策略專家。針對主題「${finalTopic}」，請產出 6 到 8 個真實使用者在 ChatGPT、Perplexity、Google 最常詢問的具體問句。
包含商業成交、在地特色、價格規格比較與常見問題。

請只回傳純 JSON：
{
  "questions": [
    { "question": "具體問句內容？", "intent": "compare|transact|local|info" }
  ]
}`

  let rawQuestions: Array<{ question: string; intent: Intent }> = []
  try {
    const qRes = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      messages: [{ role: 'user', content: questionPrompt }],
    })
    let t = qRes.text.trim()
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const s = t.indexOf('{'); const e = t.lastIndexOf('}')
    if (s >= 0 && e > s) t = t.slice(s, e + 1)
    rawQuestions = JSON.parse(t).questions ?? []
  } catch {
    rawQuestions = [
      { question: `${finalTopic} 值得推薦嗎？`, intent: 'compare' },
      { question: `如何挑選最合適的服務或產品？`, intent: 'info' },
      { question: `價格與費用標準大約是多少？`, intent: 'transact' },
      { question: `門市地點與營業時間資訊？`, intent: 'local' },
    ]
  }

  if (rawQuestions.length === 0) {
    rawQuestions.push({ question: `${finalTopic} 完整指南與特色分析`, intent: 'info' })
  }

  // 4. 建立 geo_projects
  const supabase = await createClient()
  const { data: project, error: projErr } = await supabase
    .from('geo_projects')
    .insert({
      user_id: c.userId,
      seed_topic: finalTopic,
      locale,
      exclusive_facts: exclusiveFacts,
      author: authorName,
      target_domain: targetDomain,
      auto_track: true,
    })
    .select('id')
    .single()

  if (projErr || !project) {
    return NextResponse.json({ error: '建立專案失敗' }, { status: 500 })
  }

  // 5. 寫入 geo_questions
  const qRowsToInsert = rawQuestions.map((q, idx) => ({
    project_id: project.id,
    question: q.question,
    intent: q.intent,
    opportunity_score: 85 - idx * 3,
    volume_source: 'estimated',
    status: 'written',
  }))

  const { data: insertedQuestions } = await supabase
    .from('geo_questions')
    .insert(qRowsToInsert)
    .select('id, question, intent, opportunity_score, volume_source')

  const questionsList = insertedQuestions ?? []

  // 6. 整合素材庫資料產出文章 (Claude Sonnet)
  const defaultStore = profile.branches?.[0]
  const mat: Material = {
    business: {
      name: profile.companyName || defaultStore?.name || '',
      type: 'LocalBusiness',
      url: profile.website || '',
      streetAddress: defaultStore?.address || profile.address || '',
      openingHours: defaultStore?.notes || '',
      sameAs: [],
    },
    authors: [{
      name: authorName,
      jobTitle: '品牌首席顧問 / 行銷專家',
      url: profile.website || '',
    }],
    facts: factsList.map(f => ({ label: '公司資源庫', text: f })),
  }

  const promptText = `${ARTICLE_SYSTEM}${outputLangInstruction(locale)}

【文章主題】
${finalTopic}

【必須回答的問句（每題一個 H2/H3 小標）】
${rawQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

【公司資源庫獨家事實（務必自然融入，提升真實度與 AI 引用率）】
${exclusiveFacts}

【署名（E-E-A-T author）】
${authorName}

請嚴格依輸出規則產出文章（包含 Markdown 表格、FAQ）與 JSON-LD。`

  let body_md = ''
  let json_ld: unknown = null
  let title = finalTopic

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      messages: [{ role: 'user', content: promptText }],
    })

    const artMatch = text.match(/===ARTICLE_START===([\s\S]*?)===ARTICLE_END===/)
    const jsonMatch = text.match(/===JSONLD_START===([\s\S]*?)===JSONLD_END===/)
    body_md = (artMatch ? artMatch[1] : text).trim()
    if (jsonMatch) {
      try {
        json_ld = JSON.parse(jsonMatch[1].trim())
      } catch {
        json_ld = null
      }
    }
    if (json_ld) {
      json_ld = enrichJsonLd(json_ld, mat)
    }
    const titleMatch = body_md.match(/^#\s+(.+)$/m)
    title = titleMatch ? titleMatch[1].trim() : finalTopic
  } catch (err) {
    console.error('[geo/auto-pilot] generateText error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const dedup_hash = createHash('sha256').update(body_md).digest('hex').slice(0, 32)

  // 7. 寫入 geo_articles
  const { data: articleRow, error: aErr } = await supabase
    .from('geo_articles')
    .insert({
      project_id: project.id,
      title,
      body_md,
      json_ld: json_ld ?? null,
      question_ids: (insertedQuestions ?? []).map(q => q.id),
      exclusive_used: true,
      dedup_hash,
      status: 'draft',
    })
    .select('id')
    .single()

  if (aErr || !articleRow) {
    return NextResponse.json({ error: '寫入文章失敗' }, { status: 500 })
  }

  return NextResponse.json({
    projectId: project.id,
    topic: finalTopic,
    exclusiveFacts,
    author: authorName,
    targetDomain,
    questions: questionsList,
    article: {
      articleId: articleRow.id,
      title,
      body_md,
      json_ld,
    },
  })
}
