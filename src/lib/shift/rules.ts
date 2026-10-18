// 時間制排班：可上班規則的驗證與存取（員工專區與店長代填共用）
import type { createAdminClient } from '@/lib/supabase/admin'
import { isDate, parseHHMM, SLOT_MIN } from './time'

type Admin = ReturnType<typeof createAdminClient>
const MAX_RULE_DAYS = 92

export const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

// body: { start_date, end_date, weekdays: number[], start: "HH:MM", end: "HH:MM", note? }
export function parseRule(b: Record<string, unknown>): { ok: true; rule: { start_date: string; end_date: string; weekdays: number[]; start_min: number; end_min: number; note: string } } | { ok: false; error: string } {
  const start_date = String(b.start_date ?? ''), end_date = String(b.end_date ?? '')
  if (!isDate(start_date) || !isDate(end_date)) return { ok: false, error: 'Ngày không hợp lệ / 日期格式錯誤' }
  if (end_date < start_date) return { ok: false, error: 'Ngày kết thúc phải sau ngày bắt đầu / 結束日不可早於開始日' }
  if (end_date < todayVN()) return { ok: false, error: 'Không thể chọn ngày đã qua / 不可選擇過去的日期' }
  const days = (Date.parse(end_date) - Date.parse(start_date)) / 86400000 + 1
  if (days > MAX_RULE_DAYS) return { ok: false, error: `Tối đa ${MAX_RULE_DAYS} ngày / 一次最多 ${MAX_RULE_DAYS} 天` }
  const weekdays = [...new Set((Array.isArray(b.weekdays) ? b.weekdays : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
  const start_min = parseHHMM(b.start), end_min = parseHHMM(b.end)
  if (start_min == null || end_min == null || end_min <= start_min || end_min > 1440) return { ok: false, error: 'Giờ không hợp lệ / 時間錯誤（結束需晚於開始）' }
  if (start_min % SLOT_MIN || end_min % SLOT_MIN) return { ok: false, error: `Giờ phải theo bước ${SLOT_MIN} phút / 時間需以 ${SLOT_MIN} 分鐘為單位` }
  return { ok: true, rule: { start_date, end_date, weekdays, start_min, end_min, note: String(b.note ?? '').slice(0, 200) } }
}

export async function insertRule(admin: Admin, ownerId: string, employeeId: string, store: string, b: Record<string, unknown>) {
  const p = parseRule(b)
  if (!p.ok) return { error: p.error, status: 400 as const }
  const { data, error } = await admin.from('shift_avail_rules')
    .insert({ owner_id: ownerId, employee_id: employeeId, store, ...p.rule }).select('*').single()
  if (error) return { error: error.message, status: 500 as const }
  return { rule: data }
}
