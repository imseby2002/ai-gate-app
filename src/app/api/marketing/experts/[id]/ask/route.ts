/**
 * POST /api/marketing/experts/[id]/ask — 向自製專家提問（所有方案皆可用，依實際 token 用量 × 方案倍率扣點）
 *   Body: { question: string }
 * 把專家的 system_prompt + 知識來源萃取文字塞進 context，讓 LLM 依此作答。
 * admin/employee 不計費（比照全站慣例）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { llmCost, precheckUsage, chargeUsage } from '@/lib/marketing/billing'

export const maxDuration = 60

const MAX_CONTEXT_CHARS = 180_000 // 知識庫塞進 system prompt 的上限
const MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 2000

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.expertSkills) {
    return NextResponse.json({ error: '目前方案未開放專家功能' }, { status: 403 })
  }

  const body = await req.json()
  const question = String(body.question ?? '').trim()
  if (!question) return NextResponse.json({ error: '請輸入問題' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

  // 讀專家與知識來源（RLS 保證擁有者）
  const { data: expert } = await supabase
    .from('marketing_experts')
    .select('id, name, system_prompt')
    .eq('id', id)
    .single()
  if (!expert) return NextResponse.json({ error: '找不到專家' }, { status: 404 })

  const { data: sources } = await supabase
    .from('marketing_expert_sources')
    .select('name, extracted_text')
    .eq('expert_id', id)
    .order('created_at', { ascending: true })

  // 組 system prompt：人設 + 知識庫（截斷至上限）
  const parts: string[] = []
  parts.push(expert.system_prompt?.trim()
    || `你是「${expert.name}」，一位依據下方知識庫回答問題的專屬領域顧問。`)
  parts.push('\n\n請優先依據以下知識庫內容回答；若知識庫沒有相關資訊，明確說明並謹慎作答，不要杜撰。')
  parts.push('\n\n---\n知識庫：')
  let total = parts.join('').length
  for (const s of sources ?? []) {
    if (!s.extracted_text) continue
    const block = `\n\n### ${s.name}\n${s.extracted_text}`
    if (total + block.length > MAX_CONTEXT_CHARS) { parts.push('\n\n[部分來源因長度限制未載入]'); break }
    parts.push(block)
    total += block.length
  }
  const system = parts.join('')

  // 預估：中文約 1 字 1 token（保守），輸出以上限計
  const insufficient = await precheckUsage(user.id, llmCost(MODEL, {
    inputTokens: system.length + question.length,
    outputTokens: MAX_OUTPUT_TOKENS,
  }))
  if (insufficient) return NextResponse.json(insufficient, { status: 402 })

  let answer = ''
  let usage: { inputTokens?: number; outputTokens?: number } | undefined
  try {
    const res = await generateText({
      model: createAnthropic({ apiKey })(MODEL),
      system,
      messages: [{ role: 'user', content: question }],
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    })
    answer = res.text
    usage = res.usage
  } catch (err) {
    return NextResponse.json({ error: `作答失敗：${String(err)}` }, { status: 500 })
  }

  const cost = await chargeUsage(user.id, llmCost(MODEL, usage), `[marketing] 自製專家問答（${expert.name}）`)
  return NextResponse.json({ answer, cost })
}
