// 打卡機工號（員工專區網址 /e/<工號>）：只允許數字，同公司不可重複
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const cleanAttendanceNo = (v: unknown) => String(v ?? '').trim()
export const validAttendanceNo = (v: string) => v === '' || /^\d{1,12}$/.test(v)
export const ATTENDANCE_ERR = '打卡工號只能是數字'

// 同公司是否已有其他員工使用（含曾用過的舊工號，避免舊連結導錯人）
export async function attendanceTaken(admin: Admin, ownerId: string, no: string, exceptId?: string) {
  if (!no) return null
  const { data } = await admin.from('hr_employees').select('id, name')
    .eq('owner_id', ownerId).or(`attendance_no.eq.${no},prev_attendance_nos.cs.{${no}}`)
  return (data ?? []).find(e => e.id !== exceptId) ?? null
}

// 錄取轉員工時自動給號：現有純數字工號的最大值 + 1
export async function nextAttendanceNo(admin: Admin, ownerId: string) {
  const { data } = await admin.from('hr_employees').select('attendance_no, prev_attendance_nos').eq('owner_id', ownerId)
  let max = 0
  for (const e of data ?? []) {
    for (const v of [e.attendance_no, ...((e.prev_attendance_nos as string[] | null) ?? [])]) {
      const s = String(v ?? '').trim()
      if (/^\d{1,12}$/.test(s)) max = Math.max(max, Number(s))
    }
  }
  return String(max + 1)
}
