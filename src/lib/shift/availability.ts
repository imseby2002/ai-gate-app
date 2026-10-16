// 排班可上班時段：員工送出（整份覆寫）。專屬連結與員工專區共用。
import type { createAdminClient } from '@/lib/supabase/admin'
import { listDates } from './util'

type Admin = ReturnType<typeof createAdminClient>
interface PeriodLite { id: string; start_date: string; end_date: string; slots: unknown; status: string }

export async function saveAvailability(admin: Admin, period: PeriodLite, ownerId: string, employeeId: string, picks: unknown): Promise<{ saved: number } | { error: string; status: number }> {
  if (period.status === 'confirmed') return { error: '此排班已確認，無法再修改', status: 409 }

  const validDates = new Set(listDates(period.start_date, period.end_date))
  const validSlots = new Set((Array.isArray(period.slots) ? period.slots : []).map((x: { code: string }) => x.code))
  const rows: { owner_id: string; period_id: string; employee_id: string; work_date: string; slot_code: string }[] = []
  const seen = new Set<string>()
  for (const p of Array.isArray(picks) ? picks : []) {
    const [d, slot] = String(p).split('|')
    if (!validDates.has(d) || !validSlots.has(slot) || seen.has(`${d}|${slot}`)) continue
    seen.add(`${d}|${slot}`)
    rows.push({ owner_id: ownerId, period_id: period.id, employee_id: employeeId, work_date: d, slot_code: slot })
  }

  // 整份覆寫：先刪自己的、再插入
  await admin.from('shift_availability').delete().eq('period_id', period.id).eq('employee_id', employeeId)
  if (rows.length > 0) {
    const { error } = await admin.from('shift_availability').insert(rows)
    if (error) return { error: error.message, status: 500 }
  }
  return { saved: rows.length }
}
