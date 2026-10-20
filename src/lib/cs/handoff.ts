// 真人接管（AI 靜音）判斷：webhook 決定 AI 要不要回、收件匣顯示「真人接管中」共用同一套規則。
//  - 員工在收件匣回覆或打字 → 工單主旨為 STAFF_ACTIVE_SUBJECT，最後一次動作後超過「閒置分鐘」AI 自動接回
//  - 客人要求真人、手動按「暫停 AI」 → 維持 2 小時窗口（明確要真人，不因員工沒立刻打字就讓 AI 搶話）
import type { SupabaseClient } from '@supabase/supabase-js'

export const STAFF_ACTIVE_SUBJECT = '真人接管中'
// 客人反映的現場狀況（沒熱水、送錯餐等）工單：真人正在處理這類客訴時，AI 不因員工閒置就接回
export const ONSITE_ISSUE_INTENT = '現場狀況待處理'
const ONSITE_HOLD_HOURS = 12
export const DEFAULT_HUMAN_IDLE_MINUTES = 1
const ESCALATION_STALE_HOURS = 2

// onsiteOpen：這位客人有未結的現場狀況工單。真實案例：客人沒熱水，員工回覆中閒置 1 分鐘，
// AI 接回並自己承諾「退一半房費」——客訴處理中改用 2 小時窗口，等真人處理完。
export function isHandoffActive(
  ticket: { subject?: string | null; created_at: string },
  idleMinutes: number,
  now = Date.now(),
  onsiteOpen = false,
): boolean {
  const ageMs = now - new Date(ticket.created_at).getTime()
  return ticket.subject === STAFF_ACTIVE_SUBJECT && !onsiteOpen
    ? ageMs < idleMinutes * 60_000
    : ageMs < ESCALATION_STALE_HOURS * 3600_000
}

// 有未結現場狀況工單（12 小時內建立）的客人 from_id
export async function getOnsiteOpenCustomers(supabase: SupabaseClient, userId: string, fromId?: string): Promise<Set<string>> {
  let q = supabase.from('cs_tickets').select('from_id')
    .eq('user_id', userId).eq('intent', ONSITE_ISSUE_INTENT)
    .in('status', ['open', 'in_progress'])
    .gte('created_at', new Date(Date.now() - ONSITE_HOLD_HOURS * 3600_000).toISOString())
  if (fromId) q = q.eq('from_id', fromId)
  const { data } = await q
  return new Set((data ?? []).map(r => r.from_id as string))
}

export async function getHumanIdleMinutes(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from('cs_data_sources').select('config')
    .eq('user_id', userId).eq('type', 'source_prefs').maybeSingle()
  const v = Number((data?.config as { humanIdleMinutes?: unknown } | null)?.humanIdleMinutes)
  return Number.isFinite(v) && v >= 1 ? v : DEFAULT_HUMAN_IDLE_MINUTES
}
