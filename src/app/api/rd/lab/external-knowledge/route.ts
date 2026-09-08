import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, ownerId: '' }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, ownerId: ctx.ownerId }
}

export async function POST(req: NextRequest) {
  const { user, supabase, ownerId } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const {
    source_url = '',
    source_type = 'youtube',
    raw_content = '',
    title = '',
    author = '',
  } = body

  if (!raw_content && !source_url && !title) {
    return NextResponse.json({ error: '請提供網址、標題或內容' }, { status: 400 })
  }

  // 判定實證等級 (Evidence Level)
  let evidenceLevel = 'D'
  let confidence = 'medium'

  if (source_type === 'paper' || source_url.includes('doi.org') || source_url.includes('sciencedirect') || source_url.includes('ncbi')) {
    evidenceLevel = 'A' // Peer-reviewed research
    confidence = 'high'
  } else if (source_type === 'patent' || source_type === 'pdf' || source_type === 'spec') {
    evidenceLevel = 'B' // Technical specification
    confidence = 'high'
  } else if (source_type === 'expert') {
    evidenceLevel = 'C' // Expert experience
    confidence = 'medium'
  } else if (source_type === 'youtube' || source_url.includes('youtube.com') || source_url.includes('youtu.be')) {
    evidenceLevel = 'D' // YouTube / community
    confidence = 'medium'
  } else {
    evidenceLevel = 'E' // Unverified
    confidence = 'low'
  }

  let aiSummary = ''
  let tags: string[] = []

  // 透過 AI 萃取技術細節
  if (process.env.ANTHROPIC_API_KEY && (raw_content || title)) {
    try {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const prompt = `請分析以下外部研發資料（來自 ${source_type}，實證等級 Evidence Level: ${evidenceLevel}）：
標題：${title}
來源：${source_url}
內容摘要：
${(raw_content || title).slice(0, 4000)}

請萃取成結構化研發知識：
1. 【核心技術與原理】：（提取其萃取、乳化、風味或保存機制）
2. 【配方或操作參數】：（若有具體溫度、時間、比例請條列）
3. 【科學可信度評估】：（點出 YouTuber/作者個人經驗 vs 科學實證差異）
4. 【在 Feeling Tea 的應用可能性與實驗建議】：
繁體中文，精煉實用。`

      const res = await generateText({
        model: anthropic('claude-sonnet-4-5'),
        system: '你是連鎖茶飲研發知識萃取專家，擅長將外部影片與文章轉為內部研發標準知識項目。',
        maxOutputTokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      aiSummary = res.text.trim()
    } catch {
      aiSummary = raw_content.slice(0, 300)
    }
  } else {
    aiSummary = raw_content.slice(0, 300)
  }

  const payload = {
    owner_id: ownerId,
    source_type,
    source_url,
    author: author || '外部專家',
    title: title || (source_url ? `研發參考來源 (${source_type})` : '外部知識項目'),
    topic: '風味與萃取技術',
    content_text: raw_content || '',
    summary: aiSummary,
    evidence_level: evidenceLevel,
    confidence,
    governance_status: 'external',
    tags,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('rd_external_knowledge')
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: true, fallback: true, item: payload })
  }

  return NextResponse.json({ ok: true, item: data })
}
