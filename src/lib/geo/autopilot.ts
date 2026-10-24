/**
 * GEO 一鍵全自動巡航（手動按鈕與排程共用）
 *  - suggestTopics：依公司資源庫推薦主題（可排除已做過的主題）
 *  - runAutoPilot：選題 ➔ 探勘問句 ➔ 整合公司事實 ➔ 產出文章與 JSON-LD，寫入 geo_projects / geo_questions / geo_articles
 */
import { createHash } from 'crypto'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { createAdminClient } from '@/lib/supabase/admin'
import { loadCompanyProfile, type CompanyProfile } from '@/lib/company/profile'
import { outputLangInstruction } from '@/lib/ai/output-lang'
import { enrichJsonLd, type Material } from '@/lib/geo/schema'
import { llmCost } from '@/lib/marketing/billing'

type Admin = ReturnType<typeof createAdminClient>
type Intent = 'info' | 'local' | 'compare' | 'transact'

export const AUTOPILOT_FAST_MODEL = 'claude-haiku-5-5'
export const AUTOPILOT_ARTICLE_MODEL = 'claude-sonnet-4-6'

export interface SuggestedTopic {
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

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未設定')
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function extractJson(text: string, open: '[' | '{', close: ']' | '}') {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const s = t.indexOf(open); const e = t.lastIndexOf(close)
  if (s >= 0 && e > s) t = t.slice(s, e + 1)
  return JSON.parse(t)
}

/** 公司資源庫＋品牌名稱備援（品牌名稱未填時用公司名稱） */
export async function loadPromoProfile(admin: Admin, ownerId: string): Promise<CompanyProfile> {
  const profile = await loadCompanyProfile(admin, ownerId)
  if (!profile.companyName) {
    const { data: p } = await admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle()
    if (p?.company_id) {
      const { data: c } = await admin.from('companies').select('name').eq('id', p.company_id).maybeSingle()
      if (c?.name) profile.companyName = String(c.name)
    }
  }
  return profile
}

/** 產品取樣：各分類輪流取，避免只取到同一類 */
function sampleProducts(profile: CompanyProfile, n = 12) {
  const byCat = new Map<string, NonNullable<CompanyProfile['productList']>>()
  for (const p of profile.productList ?? []) {
    const k = (p.category || '').trim().toLowerCase()
    byCat.set(k, [...(byCat.get(k) ?? []), p])
  }
  const lists = [...byCat.values()]
  const out: NonNullable<CompanyProfile['productList']> = []
  for (let i = 0; out.length < n && lists.some(l => l[i]); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i])
  return out
}

function companyContext(profile: CompanyProfile) {
  const cats = [...new Set((profile.productList ?? []).map(p => p.category).filter(Boolean))]
  return `
品牌名稱：${profile.companyName || '（未填）'}
產業別：${profile.industry || '餐飲/零售/服務'}
品牌故事：${profile.description || '（未填）'}
目標客群：${profile.targetAudience || '（未填）'}
核心賣點：${profile.competitiveAdvantage || '（未填）'}
門市（${(profile.branches ?? []).length} 間）：${(profile.branches ?? []).map(b => `${b.name}（${b.address}）`).join('、') || '（未填）'}
產品分類：${cats.join('、') || '（未填）'}
代表產品：${sampleProducts(profile).map(p => `${p.name}${p.price ? `（${p.price}）` : ''}${p.slogan ? `：${p.slogan}` : ''}`).join('、') || '（未填）'}
`
}

/** 推薦主題（以推廣本公司為目的）；avoid 為已做過的主題，focus 為本次推廣重點 */
export async function suggestTopics(admin: Admin, ownerId: string, avoid: string[] = [], locale = 'zh-TW', focus = ''): Promise<{ topics: SuggestedTopic[]; cost: number }> {
  const profile = await loadPromoProfile(admin, ownerId)
  const brand = profile.companyName || '本品牌'
  const avoidText = avoid.length
    ? `\n以下主題已經寫過，請避開相同或過於相似的主題：\n${avoid.slice(0, 40).map(a => `- ${a}`).join('\n')}\n`
    : ''
  const focusText = focus.trim() ? `\n【本次推廣重點（優先圍繞這個主題發想）】\n${focus.trim().slice(0, 500)}\n` : ''
  const prompt = `你是品牌行銷與 GEO（讓 AI 搜尋引擎引用）專家。目標是推廣「${brand}」，讓消費者在 ChatGPT、Perplexity、Google AI Overviews 詢問相關問題時，AI 會推薦或引用 ${brand}。
請根據以下公司資源庫，構思 5 個「推廣本公司」的 GEO 文章標題。

${companyContext(profile)}${focusText}${avoidText}
標題規則：
1. 每個標題都必須明確出現品牌名稱「${brand}」，或本公司的具體產品／門市名稱，不要寫成與本公司無關的一般產業文章
2. 以消費者實際會問 AI 的問題角度切入（例：哪家好喝、推薦什麼、怎麼點、在哪裡、多少錢、適合誰）
3. 主題類型盡量分散：品牌推薦、招牌／新品介紹、門市與外送資訊、點餐攻略與常見問題、與同類選擇比較（客觀、不貶低他牌）
4. 只能使用資源庫中存在的產品、門市與事實，不要編造價格、獎項或數據
5. 標題自然、具體，30 字以內為佳
${outputLangInstruction(locale)}

請只輸出純 JSON 陣列，格式如下：
[
  {
    "title": "文章標題",
    "tag": "品牌推薦 / 產品介紹 / 門市資訊 / 點餐攻略 / 比較評比",
    "reason": "推廣效益（例：搶占「河內珍奶推薦」問題的 AI 回答）",
    "exclusiveFacts": "建議融入的本公司事實（產品、門市地址、賣點）"
  }
]`
  try {
    const res = await generateText({ model: anthropic()(AUTOPILOT_FAST_MODEL), messages: [{ role: 'user', content: prompt }] })
    const topics = (extractJson(res.text, '[', ']') as SuggestedTopic[]).filter(t => t && t.title)
    return { topics, cost: llmCost(AUTOPILOT_FAST_MODEL, res.usage) }
  } catch (err) {
    console.error('[geo/autopilot] suggestTopics error', err)
    const firstProd = sampleProducts(profile, 1)[0]?.name
    const fallbackTitle = firstProd
      ? `${brand} ${firstProd} 好喝嗎？口味、價格與門市完整介紹`
      : `${brand} ${new Date().getFullYear()} 推薦指南：招牌、門市與常見問題`
    return { topics: [{ title: fallbackTitle, tag: '品牌推薦', reason: '建立品牌在 AI 引擎中的權威度', exclusiveFacts: profile.competitiveAdvantage || '' }], cost: 0 }
  }
}

export interface AutoPilotResult {
  projectId: string
  topic: string
  exclusiveFacts: string
  author: string
  targetDomain: string
  questions: Array<{ id: string; question: string; intent: string; opportunity_score: number; volume_source: string }>
  article: { articleId: string; title: string; body_md: string; json_ld: unknown }
  cost: number
}

/** 執行一次全自動巡航。db 為寫入用 client（手動＝使用者 RLS client；排程＝service-role） */
export async function runAutoPilot(opts: {
  admin: Admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  userId: string
  ownerId: string
  topic?: string
  locale?: string
}): Promise<AutoPilotResult> {
  const { admin, db, userId, ownerId } = opts
  const locale = opts.locale || 'zh-TW'
  const profile = await loadPromoProfile(admin, ownerId)
  const ai = anthropic()
  let cost = 0

  // 1. 決定主題
  let finalTopic = (opts.topic ?? '').trim()
  if (!finalTopic) {
    const firstProd = sampleProducts(profile, 1)[0]?.name
    const firstBranch = profile.branches?.[0]?.name
    const brand = profile.companyName || '優質品牌'
    finalTopic = firstProd
      ? `${brand} ${firstProd} 推薦評比與常見問題完整解析`
      : firstBranch ? `${firstBranch} 探店指南、特色推薦與真實評價` : `${brand} ${new Date().getFullYear()} 專業推薦指南與特色解析`
  }

  // 2. 公司資源庫事實
  const factsList: string[] = []
  if (profile.companyName) factsList.push(`品牌名稱：${profile.companyName}`)
  if (profile.competitiveAdvantage) factsList.push(`核心優勢：${profile.competitiveAdvantage}`)
  if (profile.description) factsList.push(`品牌故事：${profile.description}`)
  for (const b of (profile.branches ?? []).slice(0, 3)) factsList.push(`門市【${b.name}】：地址位於 ${b.address}。${b.notes || ''}`)
  for (const p of sampleProducts(profile, 8)) factsList.push(`主打產品【${p.name}】：售價 ${p.price}。${p.slogan || ''} ${p.description || ''}`)
  const exclusiveFacts = factsList.join('\n')
  const authorName = profile.companyName ? `${profile.companyName} 專業團隊` : '在地專業行銷團隊'
  const targetDomain = profile.website || ''

  // 3. 探勘問句
  const questionPrompt = `你是 GEO 策略專家。針對主題「${finalTopic}」，請產出 6 到 8 個真實使用者在 ChatGPT、Perplexity、Google 最常詢問的具體問句。
包含商業成交、在地特色、價格規格比較與常見問題。${outputLangInstruction(locale)}

請只回傳純 JSON：
{
  "questions": [
    { "question": "具體問句內容？", "intent": "compare|transact|local|info" }
  ]
}`
  let rawQuestions: Array<{ question: string; intent: Intent }> = []
  try {
    const qRes = await generateText({ model: ai(AUTOPILOT_FAST_MODEL), messages: [{ role: 'user', content: questionPrompt }] })
    cost += llmCost(AUTOPILOT_FAST_MODEL, qRes.usage)
    rawQuestions = (extractJson(qRes.text, '{', '}').questions ?? []).filter((q: { question?: string }) => q?.question)
  } catch (err) {
    console.error('[geo/autopilot] questions error', err)
  }
  if (rawQuestions.length === 0) {
    rawQuestions = [
      { question: `${finalTopic} 值得推薦嗎？`, intent: 'compare' },
      { question: `如何挑選最合適的服務或產品？`, intent: 'info' },
      { question: `價格與費用標準大約是多少？`, intent: 'transact' },
      { question: `門市地點與營業時間資訊？`, intent: 'local' },
    ]
  }

  // 4. 產出文章
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
    authors: [{ name: authorName, jobTitle: '品牌首席顧問 / 行銷專家', url: profile.website || '' }],
    facts: factsList.map(f => ({ label: '公司資源庫', text: f })),
  }
  const promptText = `${ARTICLE_SYSTEM}${outputLangInstruction(locale)}

【文章主題】
${finalTopic}

【必須回答的問句（每題一個 H2/H3 小標）】
${rawQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

【推廣目的】
這篇文章是為了推廣「${profile.companyName || authorName}」：讓讀者與 AI 引擎在回答相關問題時認識並推薦本品牌。文中自然帶出品牌名稱、招牌產品與門市資訊（各至少一次），但保持客觀可信、不誇大、不貶低其他品牌。

【公司資源庫獨家事實（務必自然融入，提升真實度與 AI 引用率）】
${exclusiveFacts}

【署名（E-E-A-T author）】
${authorName}

請嚴格依輸出規則產出文章（包含 Markdown 表格、FAQ）與 JSON-LD。`

  const { text, usage } = await generateText({ model: ai(AUTOPILOT_ARTICLE_MODEL), messages: [{ role: 'user', content: promptText }], maxOutputTokens: 8000 })
  cost += llmCost(AUTOPILOT_ARTICLE_MODEL, usage)
  const artMatch = text.match(/===ARTICLE_START===([\s\S]*?)===ARTICLE_END===/)
  const jsonMatch = text.match(/===JSONLD_START===([\s\S]*?)===JSONLD_END===/)
  const body_md = (artMatch ? artMatch[1] : text).trim()
  let json_ld: unknown = null
  if (jsonMatch) { try { json_ld = JSON.parse(jsonMatch[1].trim()) } catch { json_ld = null } }
  if (json_ld) json_ld = enrichJsonLd(json_ld, mat)
  const title = body_md.match(/^#\s+(.+)$/m)?.[1].trim() || finalTopic

  // 5. 寫入專案／問句／文章（文章產出成功才建檔，避免留下空專案）
  const { data: project, error: projErr } = await db.from('geo_projects').insert({
    user_id: userId, seed_topic: finalTopic, locale, exclusive_facts: exclusiveFacts,
    author: authorName, target_domain: targetDomain, auto_track: true,
  }).select('id').single()
  if (projErr || !project) throw new Error('建立專案失敗')

  const { data: insertedQuestions } = await db.from('geo_questions').insert(rawQuestions.map((q, idx) => ({
    project_id: project.id, question: q.question, intent: q.intent,
    opportunity_score: 85 - idx * 3, volume_source: 'estimated', status: 'written',
  }))).select('id, question, intent, opportunity_score, volume_source')

  const { data: articleRow, error: aErr } = await db.from('geo_articles').insert({
    project_id: project.id, title, body_md, json_ld: json_ld ?? null,
    question_ids: (insertedQuestions ?? []).map((q: { id: string }) => q.id),
    exclusive_used: true,
    dedup_hash: createHash('sha256').update(body_md).digest('hex').slice(0, 32),
    status: 'draft',
  }).select('id').single()
  if (aErr || !articleRow) throw new Error('寫入文章失敗')

  return {
    projectId: project.id, topic: finalTopic, exclusiveFacts, author: authorName, targetDomain,
    questions: insertedQuestions ?? [],
    article: { articleId: articleRow.id, title, body_md, json_ld },
    cost,
  }
}
