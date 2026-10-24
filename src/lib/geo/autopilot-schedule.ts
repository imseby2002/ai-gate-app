import type { createAdminClient } from '@/lib/supabase/admin'
import { companyMemberIds } from '@/lib/connector/company-resources'
import { suggestTopics } from '@/lib/geo/autopilot'

type Admin = ReturnType<typeof createAdminClient>

export interface AutoPilotSchedule {
  owner_id: string
  created_by: string
  enabled: boolean
  frequency: 'daily' | 'weekly'
  weekdays: number[]
  run_hour: number
  timezone: string
  locale: string
  topics: string[]
  auto_topics: boolean
  last_run_date: string | null
  last_run_at: string | null
  last_status: string | null
  last_project_id: string | null
}

export const SCHEDULE_DEFAULTS = {
  enabled: false, frequency: 'weekly' as const, weekdays: [1], run_hour: 9,
  timezone: 'Asia/Ho_Chi_Minh', locale: 'zh-TW', topics: [] as string[], auto_topics: true,
}

/** 指定時區的當地日期（YYYY-MM-DD）、星期（0=日）與小時 */
export function localNow(timezone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now).map(p => [p.type, p.value]))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: wd, hour: Number(parts.hour) }
}

export function isDue(s: AutoPilotSchedule, now = new Date()) {
  if (!s.enabled) return false
  const l = localNow(s.timezone || 'Asia/Ho_Chi_Minh', now)
  if (s.last_run_date === l.date) return false
  if (l.hour < s.run_hour) return false
  if (s.frequency === 'weekly' && !(s.weekdays ?? []).includes(l.weekday)) return false
  return true
}

/** 公司成員 id（含 owner 本人） */
export async function ownerMemberIds(admin: Admin, ownerId: string): Promise<string[]> {
  const { data: p } = await admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle()
  const ids = p?.company_id ? await companyMemberIds(p.company_id as string) : []
  return [...new Set([ownerId, ...ids])]
}

/** 決定這次要寫的主題：先用排程清單中尚未寫過的，否則（允許時）由 AI 依公司資源庫產生新主題 */
export async function pickTopic(admin: Admin, s: AutoPilotSchedule): Promise<{ topic: string; remaining: string[]; cost: number } | null> {
  const members = await ownerMemberIds(admin, s.owner_id)
  const { data: done } = await admin.from('geo_projects').select('seed_topic').in('user_id', members)
    .order('created_at', { ascending: false }).limit(200)
  const used = new Set((done ?? []).map(d => String(d.seed_topic ?? '').trim().toLowerCase()))

  const queue = (s.topics ?? []).map(t => t.trim()).filter(Boolean)
  const idx = queue.findIndex(t => !used.has(t.toLowerCase()))
  if (idx >= 0) return { topic: queue[idx], remaining: queue.filter((t, i) => i !== idx && !used.has(t.toLowerCase())), cost: 0 }
  if (!s.auto_topics) return null

  const { topics, cost } = await suggestTopics(admin, s.owner_id, [...used].slice(0, 40), s.locale)
  const fresh = topics.find(t => !used.has(t.title.trim().toLowerCase()))
  return fresh ? { topic: fresh.title, remaining: [], cost } : null
}
