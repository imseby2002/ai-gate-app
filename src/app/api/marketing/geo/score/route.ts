/**
 * POST /api/marketing/geo/score
 * GEO Writer 步驟3 — 機會分數
 * 機會分數 = 搜尋訊號分（KeywordProvider 免費版）× 商業意圖分（step1 intent）× AI 端競爭稀缺分（Perplexity）
 * 將結果寫回 geo_questions，並回傳給前端標示數據來源（🟢實測/🟡推估/⚪AI推測）。
 *
 * Body: { projectId: string; location?: string }
 * Resp: { questions: { id, opportunity_score, intent_score, competition_score, volume_source, signal }[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKeywordProvider } from '@/lib/geo/providers'
import { intentScore, searchSignal, opportunity, clampScarcity } from '@/lib/geo/scoring'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export const maxDuration = 120

/** 用 Perplexity online 估每個問句「現有可被 AI 引用的優質來源數量」(0–10)，愈少→愈稀缺→機會愈大 */
async function fetchCompetition(
  questions: { id: string; question: string }[],
  locale: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!process.env.PERPLEXITY_API_KEY) return out
  try {
    const perplexity = createOpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
    const list = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
    const { text } = await generateText({
      model: perplexity.chat('sonar'),
      messages: [{
        role: 'user',
        content: `針對以下每個問句，評估目前網路上「已有多少篇高品質、結構清楚、容易被 AI（ChatGPT/Perplexity/Google AIO）直接引用」的內容，給 0–10 的整數（0=幾乎沒有、10=競爭激烈已飽和）。語系：${locale}。
只回傳純 JSON 陣列，順序與題號一致：[{"n":1,"sources":整數}, ...]

${list}`,
      }],
      maxOutputTokens: 800,
    })
    const m = text.match(/\[[\s\S]*\]/)
    if (m) {
      const arr = JSON.parse(m[0]) as { n: number; sources: number }[]
      for (const item of arr) {
        const q = questions[item.n - 1]
        if (q && Number.isFinite(item.sources)) out[q.id] = Math.min(10, Math.max(0, item.sources))
      }
    }
  } catch (err) {
    console.error('[geo/score] perplexity', err)
  }
  return out
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, location } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data: project } = await supabase
    .from('geo_projects')
    .select('id, locale')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  const { data: questions } = await supabase
    .from('geo_questions')
    .select('id, question, intent')
    .eq('project_id', projectId)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: '沒有問句可評分' }, { status: 404 })
  }

  const locale = project.locale ?? 'zh-TW'
  const provider = getKeywordProvider()
  const loc = location || ''

  // 競爭稀缺（一次 Perplexity 批次；無金鑰時為空 → 退回 AI推測中性值）
  const competitionMap = await fetchCompetition(
    questions.map(q => ({ id: q.id, question: q.question })),
    locale,
  )

  // 搜尋訊號逐題（免費 Autocomplete，限併發）
  const results: {
    id: string
    opportunity_score: number
    intent_score: number
    competition_score: number
    volume_source: string
    signal: number
  }[] = []

  const CONCURRENCY = 4
  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const batch = questions.slice(i, i + CONCURRENCY)
    const scored = await Promise.all(batch.map(async q => {
      const metrics = await provider.getMetrics(q.question, locale, loc).catch(() => [])
      const sig = searchSignal(metrics)
      const iScore = intentScore(q.intent)

      const hasComp = q.id in competitionMap
      const competition = hasComp ? competitionMap[q.id] / 10 : 0.4 // 無資料→中性
      const scarcity = clampScarcity(1 - competition)

      return {
        id: q.id,
        opportunity_score: opportunity(sig.score, iScore, scarcity),
        intent_score: Number(iScore.toFixed(2)),
        competition_score: Number(competition.toFixed(2)),
        volume_source: sig.source,
        signal: Number(sig.score.toFixed(2)),
      }
    }))
    results.push(...scored)
  }

  // 寫回 DB
  await Promise.all(results.map(r =>
    supabase.from('geo_questions').update({
      opportunity_score: r.opportunity_score,
      intent_score: r.intent_score,
      competition_score: r.competition_score,
      volume_source: r.volume_source,
    }).eq('id', r.id),
  ))

  return NextResponse.json({ questions: results })
}
