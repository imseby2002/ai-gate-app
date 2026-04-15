import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const maxDuration = 60

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

async function tavilySearch(query: string): Promise<TavilyResponse> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 6,
      include_answer: true,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tavily error: ${err}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, industry } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

  // ── 1. Tavily 並行搜尋三個面向 ───────────────────────────────────
  const queries = [
    `${topic} ${industry ?? ''} 市場趨勢 2024 2025`,
    `${topic} ${industry ?? ''} 競品分析 主要競爭者`,
    `${topic} ${industry ?? ''} 消費者需求 目標受眾`,
  ]

  const searchResults = await Promise.allSettled(queries.map(tavilySearch))

  // Flatten and deduplicate results
  const allResults: string[] = []
  for (const r of searchResults) {
    if (r.status === 'fulfilled') {
      if (r.value.answer) allResults.push(r.value.answer)
      for (const item of r.value.results.slice(0, 2)) {
        allResults.push(`【${item.title}】\n${item.content}`)
      }
    }
  }

  if (allResults.length === 0) {
    return NextResponse.json({ error: 'Tavily 搜尋無結果，請確認 TAVILY_API_KEY' }, { status: 503 })
  }

  const rawContent = allResults.join('\n\n---\n\n')

  // ── 2. DeepSeek 整理摘要 ─────────────────────────────────────────
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })

  const { text } = await generateText({
    model: deepseek.chat('deepseek-chat'),
    messages: [
      {
        role: 'system',
        content: '你是一位市場調查分析師，擅長從網路資料中提煉出有用的行銷洞察，輸出清晰易讀的繁體中文報告。',
      },
      {
        role: 'user',
        content: `請根據以下從網路蒐集到的原始資料，整理出一份行銷市場調查摘要：

主題：${topic}
產業：${industry ?? '未指定'}

原始資料：
${rawContent.slice(0, 8000)}

請整理成以下格式（條列式，每項 1-2 句）：

【市場趨勢】（3-5點）
• ...

【主要競品】（3-5家，含特色）
• ...

【目標受眾特徵】
• ...

【熱門關鍵字】
• ...

【消費者痛點】（3點）
• ...`,
      },
    ],
    maxOutputTokens: 2048,
  })

  return NextResponse.json({ data: text })
}
