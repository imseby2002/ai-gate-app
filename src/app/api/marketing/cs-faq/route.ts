import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

export interface FaqItem {
  id: string          // nanoid
  q: string           // customer question (cleaned)
  a: string           // correct answer
  keywords: string[]  // trigger keywords for matching
  created_at: string
  source?: string     // 'ticket' | 'manual'
}

interface FaqConfig {
  items: FaqItem[]
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10)
}

// GET  /api/marketing/cs-faq?industry=homestay  → list all FAQ items
// POST /api/marketing/cs-faq                    → add/learn a new FAQ item

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry') ?? 'homestay'

  const { data: src } = await supabase
    .from('cs_data_sources')
    .select('id, config')
    .eq('user_id', user.id)
    .eq('type', 'faq')
    .eq('industry', industry)
    .maybeSingle()

  const items: FaqItem[] = (src?.config as FaqConfig)?.items ?? []
  return NextResponse.json({ sourceId: src?.id ?? null, items })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { q, a, keywords, industry = 'homestay', autoSuggest = false, context = '' } = await req.json()

  if (!a?.trim()) return NextResponse.json({ error: '答案不可為空' }, { status: 400 })

  let finalQ = q?.trim() || ''
  let finalKeywords: string[] = keywords ?? []

  // AI auto-suggest: clean up Q and extract keywords from context
  if (autoSuggest && process.env.GOOGLE_AI_API_KEY) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        messages: [{
          role: 'user',
          content: `以下是一段客戶問題與客服標準答案的對話紀錄。

客戶問題（原文）：${context || q || '（未提供）'}
客服標準答案：${a}

請：
1. 把「客戶問題」改寫成一個簡潔的問句（20字以內，繁體中文）
2. 列出 3-5 個觸發這條 FAQ 的關鍵字（單詞或短語，逗號分隔）

只回傳以下 JSON，不要其他說明：
{"q": "改寫後的問句", "keywords": ["關鍵字1", "關鍵字2", "關鍵字3"]}`,
        }],
      })
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        if (parsed.q) finalQ = parsed.q
        if (Array.isArray(parsed.keywords)) finalKeywords = parsed.keywords
      }
    } catch { /* 忽略 AI 錯誤，使用原始值 */ }
  }

  if (!finalQ) finalQ = a.slice(0, 40) + '（客服解答）'

  // Get or create FAQ data source
  let { data: src } = await supabase
    .from('cs_data_sources')
    .select('id, config')
    .eq('user_id', user.id)
    .eq('type', 'faq')
    .eq('industry', industry)
    .maybeSingle()

  const newItem: FaqItem = {
    id: nanoid(),
    q: finalQ,
    a: a.trim(),
    keywords: finalKeywords,
    created_at: new Date().toISOString(),
    source: 'ticket',
  }

  if (!src) {
    const { data: created } = await supabase
      .from('cs_data_sources')
      .insert({
        user_id: user.id,
        name: '自動學習 FAQ',
        type: 'faq',
        config: { items: [newItem] },
        enabled: true,
        industry,
      })
      .select()
      .single()
    src = created
  } else {
    const existing = ((src.config as FaqConfig)?.items ?? [])
    await supabase
      .from('cs_data_sources')
      .update({
        config: { items: [...existing, newItem] },
        updated_at: new Date().toISOString(),
      })
      .eq('id', src.id)
  }

  return NextResponse.json({ ok: true, item: newItem, sourceId: src?.id })
}

// DELETE /api/marketing/cs-faq?industry=homestay&itemId=xxx
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry') ?? 'homestay'
  const itemId   = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const { data: src } = await supabase
    .from('cs_data_sources')
    .select('id, config')
    .eq('user_id', user.id)
    .eq('type', 'faq')
    .eq('industry', industry)
    .maybeSingle()

  if (!src) return NextResponse.json({ error: '找不到 FAQ 資料源' }, { status: 404 })

  const items = ((src.config as FaqConfig)?.items ?? []).filter((i: FaqItem) => i.id !== itemId)
  await supabase
    .from('cs_data_sources')
    .update({ config: { items }, updated_at: new Date().toISOString() })
    .eq('id', src.id)

  return NextResponse.json({ ok: true })
}

// PATCH /api/marketing/cs-faq  → update one item
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industry = 'homestay', itemId, q, a, keywords } = await req.json()

  const { data: src } = await supabase
    .from('cs_data_sources')
    .select('id, config')
    .eq('user_id', user.id)
    .eq('type', 'faq')
    .eq('industry', industry)
    .maybeSingle()

  if (!src) return NextResponse.json({ error: '找不到 FAQ 資料源' }, { status: 404 })

  const items = ((src.config as FaqConfig)?.items ?? []).map((i: FaqItem) =>
    i.id === itemId ? { ...i, q: q ?? i.q, a: a ?? i.a, keywords: keywords ?? i.keywords } : i
  )
  await supabase
    .from('cs_data_sources')
    .update({ config: { items }, updated_at: new Date().toISOString() })
    .eq('id', src.id)

  return NextResponse.json({ ok: true })
}
