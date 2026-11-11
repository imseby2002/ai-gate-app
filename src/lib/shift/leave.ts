// 請假（hr_leave_requests）與排班串接：待審核與已核准的請假日都視為不能排班。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const LEAVE_TYPES = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'] as const
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRow {
  id: string; employee_id: string; leave_type: string; start_date: string; end_date: string
  days: number; reason: string; status: LeaveStatus; created_at?: string
}

/** 期間內（含頭尾）待審核或已核准的請假 */
export async function leavesBetween(db: Admin, owner: string, employeeIds: string[], from: string, to: string): Promise<LeaveRow[]> {
  if (!employeeIds.length) return []
  const { data } = await db.from('hr_leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, days, reason, status')
    .eq('owner_id', owner).in('employee_id', employeeIds).in('status', ['pending', 'approved'])
    .lte('start_date', to).gte('end_date', from)
  return (data ?? []) as LeaveRow[]
}

/** 該員工該日的請假（已核准優先） */
export function leaveOn(leaves: LeaveRow[], employeeId: string, date: string): LeaveRow | undefined {
  const hits = leaves.filter(l => l.employee_id === employeeId && l.start_date <= date && l.end_date >= date)
  return hits.find(l => l.status === 'approved') ?? hits[0]
}

/** 起訖日的天數（含頭尾） */
export function leaveDays(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
}
