// 行銷中心「製作日誌／報告」：公司級日誌——記錄「哪位同仁」在行銷系統做了什麼（skill_runs 自動累積），
// 依人員與技能彙整，並可 AI 產出製作報告。
import { NextRequest, NextResponse } from 'next/server'
import { getSkill } from '@/lib/skills/registry'
import { marketingCompany } from '@/lib/marketing/company'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

type Admin = ReturnType<typeof createAdminClient>

export const maxDuration = 60

const label = (id: string) => getSkill(id)?.label ?? id
const inputSummary = (input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  const o = input as Record<string, unknown>
  const first = o.topic ?? o.product ?? o.productName ?? o.persona ?? o.niche ?? o.title ?? Object.values(o)[0]
  return String(first ?? '').slice(0, 60)
}

// 取公司成員名稱對照
async function staffNames(admin: Admin, memberIds: string[]): Promise<Record<string, string>> {
  const { data } = await admin.from('profiles').select('id, full_name, email').in('id', memberIds)
  const m: Record<string, string> = {}
  for (const r of data ?? []) m[r.id as string] = String(r.full_name || r.email || '').trim() || String(r.id).slice(0, 8)
  return m
}

// 製作日誌（公司全體，近 N 天）。?days=（預設 30）
export async function GET(req: NextRequest) {
  const c = await marketingCompany(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const [{ data, error }, names] = await Promise.all([
    c.admin.from('skill_runs')
      .select('id, user_id, skill_id, input, status, credits_spent, created_at')
      .in('user_id', c.memberIds).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(300),
    staffNames(c.admin, c.memberIds),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const items = (data ?? []).map(r => ({
    id: r.id, staff: names[r.user_id as string] ?? '—', skill_id: r.skill_id, skill_label: label(r.skill_id as string),
    summary: inputSummary(r.input), status: r.status, credits: Number(r.credits_spent) || 0, created_at: r.created_at,
  }))
  let credits = 0
  const bySkill: Record<string, { label: string; count: number; credits: number }> = {}
  const byStaff: Record<string, { name: string; count: number; credits: number }> = {}
  for (const it of items) {
    credits += it.credits
    const g = (bySkill[it.skill_id] ??= { label: it.skill_label, count: 0, credits: 0 }); g.count++; g.credits += it.credits
    const p = (byStaff[it.staff] ??= { name: it.staff, count: 0, credits: 0 }); p.count++; p.credits += it.credits
  }
  return NextResponse.json({
    items, total: items.length, credits, days,
    bySkill: Object.values(bySkill).sort((a, b) => b.count - a.count),
    byStaff: Object.values(byStaff).sort((a, b) => b.count - a.count),
  })
}

// AI 製作報告。body: { days? }
export async function POST(req: NextRequest) {
  const c = await marketingCompany(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const days = Math.min(365, Math.max(1, Number(b.days) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const [{ data }, names] = await Promise.all([
    c.admin.from('skill_runs').select('user_id, skill_id, input, status, credits_spent')
      .in('user_id', c.memberIds).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(600),
    staffNames(c.admin, c.memberIds),
  ])
  const rows = data ?? []
  if (rows.length === 0) return NextResponse.json({ report: `近 ${days} 天內公司尚無行銷製作紀錄。` })

  const bySkill: Record<string, { label: string; count: number; ok: number }> = {}
  const byStaff: Record<string, { name: string; count: number }> = {}
  let credits = 0
  for (const r of rows) {
    const g = (bySkill[r.skill_id as string] ??= { label: label(r.skill_id as string), count: 0, ok: 0 })
    g.count++; if (r.status === 'success') g.ok++
    const nm = names[r.user_id as string] ?? '—'
    ;(byStaff[nm] ??= { name: nm, count: 0 }).count++
    credits += Number(r.credits_spent) || 0
  }
  const skillFacts = Object.values(bySkill).map(g => `- ${g.label}：${g.count} 次（成功 ${g.ok}）`).join('\n')
  const staffFacts = Object.values(byStaff).sort((a, b) => b.count - a.count).map(p => `- ${p.name}：${p.count} 次`).join('\n')

  const system = `你是行銷團隊主管，為公司撰寫「行銷製作日誌報告」。依實際紀錄總結本期做了哪些行銷產出、各同仁產能、成功率，並給下一步建議。繁體中文、務實、350 字內，不要編造資料沒有的數字。`
  const user = `期間：近 ${days} 天\n總製作 ${rows.length} 次、總花費 ${Math.round(credits * 100) / 100} 點\n各項製作：\n${skillFacts}\n各同仁產能：\n${staffFacts}`
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 1200, messages: [{ role: 'user', content: user }] })
    return NextResponse.json({ report: res.text.trim(), total: rows.length, credits })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
