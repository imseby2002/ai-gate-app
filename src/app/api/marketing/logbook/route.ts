// 行銷中心「製作日誌／報告」：
//   日誌＝skill_runs（每次專家模式產出自動記錄）；報告＝AI 依期間彙整製作活動。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSkill } from '@/lib/skills/registry'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

async function authMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('user_type, is_active, enabled_modules').eq('id', user.id).single()
  if (!profile || profile.is_active === false) return null
  if (profile.user_type !== 'admin') {
    const enabled: string[] = profile.enabled_modules ?? []
    if (!enabled.includes('marketing')) return null
  }
  return { supabase, userId: user.id }
}

const label = (id: string) => getSkill(id)?.label ?? id
const inputSummary = (input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  const o = input as Record<string, unknown>
  const first = o.topic ?? o.product ?? o.productName ?? o.persona ?? o.niche ?? o.title ?? Object.values(o)[0]
  return String(first ?? '').slice(0, 60)
}

// 製作日誌（近 N 筆）。?days= 期間（預設 30）
export async function GET(req: NextRequest) {
  const a = await authMarketing(); if (!a) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data, error } = await a.supabase.from('skill_runs')
    .select('id, skill_id, input, status, credits_spent, created_at')
    .eq('user_id', a.userId).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const items = (data ?? []).map(r => ({
    id: r.id, skill_id: r.skill_id, skill_label: label(r.skill_id as string),
    summary: inputSummary(r.input), status: r.status, credits: Number(r.credits_spent) || 0, created_at: r.created_at,
  }))
  // 依技能彙總
  const bySkill: Record<string, { label: string; count: number; credits: number }> = {}
  let credits = 0
  for (const it of items) {
    const g = (bySkill[it.skill_id] ??= { label: it.skill_label, count: 0, credits: 0 })
    g.count++; g.credits += it.credits; credits += it.credits
  }
  return NextResponse.json({ items, total: items.length, credits, bySkill: Object.values(bySkill).sort((a, b) => b.count - a.count), days })
}

// 產生 AI 製作報告。body: { days? }
export async function POST(req: NextRequest) {
  const a = await authMarketing(); if (!a) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const days = Math.min(365, Math.max(1, Number(b.days) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data } = await a.supabase.from('skill_runs')
    .select('skill_id, input, status, credits_spent, created_at')
    .eq('user_id', a.userId).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(500)

  const rows = data ?? []
  if (rows.length === 0) return NextResponse.json({ report: `近 ${days} 天內尚無製作紀錄。` })

  const bySkill: Record<string, { label: string; count: number; ok: number; credits: number; samples: string[] }> = {}
  for (const r of rows) {
    const g = (bySkill[r.skill_id as string] ??= { label: label(r.skill_id as string), count: 0, ok: 0, credits: 0, samples: [] })
    g.count++; if (r.status === 'success') g.ok++; g.credits += Number(r.credits_spent) || 0
    const s = inputSummary(r.input); if (s && g.samples.length < 5) g.samples.push(s)
  }
  const facts = Object.values(bySkill).map(g =>
    `- ${g.label}：${g.count} 次（成功 ${g.ok}）、花費 ${Math.round(g.credits * 100) / 100} 點；範例：${g.samples.join('、') || '—'}`).join('\n')
  const totalCredits = rows.reduce((t, r) => t + (Number(r.credits_spent) || 0), 0)

  const system = `你是行銷團隊主管，為公司撰寫「行銷製作日誌報告」。依實際製作紀錄，條列本期做了哪些行銷產出、產能重點、成功率與花費，並給下一步建議。繁體中文、務實、350 字內，不要編造資料沒有的數字。`
  const user = `期間：近 ${days} 天\n總製作 ${rows.length} 次、總花費 ${Math.round(totalCredits * 100) / 100} 點\n各項製作：\n${facts}`
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 1200, messages: [{ role: 'user', content: user }] })
    return NextResponse.json({ report: res.text.trim(), total: rows.length, credits: totalCredits })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
