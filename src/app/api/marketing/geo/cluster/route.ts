/**
 * POST /api/marketing/geo/cluster
 * GEO Writer 步驟4 — 問句聚叢（防內容農場機制 1）
 * haiku 把相似問句合併成叢，一叢一篇（非一問一篇），並指定 1 個 Pillar 支柱叢。
 * 寫入 geo_clusters 並回填 geo_questions.cluster_id。
 *
 * Body: { projectId: string }
 * Resp: { clusters: { id, title, pillar, questionIds }[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { outputLangInstruction } from '@/lib/ai/output-lang'

export const maxDuration = 60

const SYSTEM = `你是 GEO 內容架構師。把使用者的問句依「同一個搜尋意圖／同一篇文章能一起回答」分組成叢（cluster），一叢之後會寫成一篇文章。
規則：
- 相似或子題關係的問句合併到同一叢，避免一問一篇造成內容農場。
- 指定恰好 1 個叢為 Pillar（支柱長文，最核心、涵蓋面最廣），其餘為 Cluster 子題。
- 每叢給一個精煉標題。
只回傳純 JSON：
{ "clusters": [ { "title": "叢標題", "pillar": true|false, "questionIndexes": [題號整數...] } ] }
題號用我提供清單的數字。`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data: project } = await supabase
    .from('geo_projects')
    .select('id, locale')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  const { data: questions } = await supabase
    .from('geo_questions')
    .select('id, question')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: '沒有問句可聚叢' }, { status: 404 })
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')

  let parsed: { title: string; pillar: boolean; questionIndexes: number[] }[]
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      messages: [{ role: 'user', content: `${SYSTEM}${outputLangInstruction(project.locale)}\n\n【問句清單】\n${list}` }],
      maxOutputTokens: 1200,
    })
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 })
    parsed = (JSON.parse(m[0]).clusters ?? []).filter(
      (c: { questionIndexes?: number[] }) => Array.isArray(c.questionIndexes) && c.questionIndexes.length > 0,
    )
  } catch (err) {
    console.error('[geo/cluster]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
  if (parsed.length === 0) return NextResponse.json({ error: '聚叢失敗' }, { status: 500 })

  // 確保恰好一個 pillar
  if (!parsed.some(c => c.pillar)) parsed[0].pillar = true

  // 清掉舊叢（重新聚叢）
  await supabase.from('geo_questions').update({ cluster_id: null }).eq('project_id', projectId)
  await supabase.from('geo_clusters').delete().eq('project_id', projectId)

  const out: { id: string; title: string; pillar: boolean; questionIds: string[] }[] = []
  for (const c of parsed) {
    const qIds = c.questionIndexes
      .map(n => questions[n - 1]?.id)
      .filter((id): id is string => !!id)
    if (qIds.length === 0) continue

    const { data: cluster, error: cErr } = await supabase
      .from('geo_clusters')
      .insert({ project_id: projectId, title: c.title || '未命名叢', pillar: !!c.pillar, question_ids: qIds })
      .select('id, title, pillar')
      .single()
    if (cErr || !cluster) {
      console.error('[geo/cluster] insert', cErr)
      continue
    }
    await supabase.from('geo_questions').update({ cluster_id: cluster.id }).in('id', qIds)
    out.push({ id: cluster.id, title: cluster.title, pillar: cluster.pillar, questionIds: qIds })
  }

  return NextResponse.json({ clusters: out })
}
