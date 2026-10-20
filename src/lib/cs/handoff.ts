// 真人接管（AI 靜音）判斷：webhook 決定 AI 要不要回、收件匣顯示「真人接管中」共用同一套規則。
//  - 員工在收件匣回覆或打字 → 工單主旨為 STAFF_ACTIVE_SUBJECT，最後一次動作後超過「閒置分鐘」AI 自動接回
//  - 客人要求真人、手動按「暫停 AI」 → 維持 2 小時窗口（明確要真人，不因員工沒立刻打字就讓 AI 搶話）
import type { SupabaseClient } from '@supabase/supabase-js'

export const STAFF_ACTIVE_SUBJECT = '真人接管中'
// 客人反映的現場狀況（沒熱水、送錯餐等）工單。真人處理中時 AI 照常接回回答其他問題，
// 但這件事只能說「管家處理中」（見 webhook 的 buildOnsiteInProgressInstruction）。
export const ONSITE_ISSUE_INTENT = '現場狀況待處理'
const ONSITE_OPEN_HOURS = 12
export const DEFAULT_HUMAN_IDLE_MINUTES = 1
const ESCALATION_STALE_HOURS = 2

export function isHandoffActive(
  ticket: { subject?: string | null; created_at: string },
  idleMinutes: number,
  now = Date.now(),
): boolean {
  const ageMs = now - new Date(ticket.created_at).getTime()
  return ticket.subject === STAFF_ACTIVE_SUBJECT
    ? ageMs < idleMinutes * 60_000
    : ageMs < ESCALATION_STALE_HOURS * 3600_000
}

// 這位客人 12 小時內、還沒結案的現場狀況（工單主旨與摘要）
export async function getOpenOnsiteIssues(supabase: SupabaseClient, userId: string, fromId: string): Promise<string[]> {
  const { data } = await supabase.from('cs_tickets').select('subject, description')
    .eq('user_id', userId).eq('from_id', fromId).eq('intent', ONSITE_ISSUE_INTENT)
    .in('status', ['open', 'in_progress'])
    .gte('created_at', new Date(Date.now() - ONSITE_OPEN_HOURS * 3600_000).toISOString())
    .order('created_at', { ascending: false }).limit(3)
  return (data ?? []).map(r => {
    const summary = String(r.description ?? '').match(/摘要：([^\n]+)/)?.[1]
    return (summary || String(r.subject ?? '').replace(/^現場狀況：/, '')).slice(0, 150)
  }).filter(Boolean)
}

export async function getHumanIdleMinutes(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from('cs_data_sources').select('config')
    .eq('user_id', userId).eq('type', 'source_prefs').maybeSingle()
  const v = Number((data?.config as { humanIdleMinutes?: unknown } | null)?.humanIdleMinutes)
  return Number.isFinite(v) && v >= 1 ? v : DEFAULT_HUMAN_IDLE_MINUTES
}
