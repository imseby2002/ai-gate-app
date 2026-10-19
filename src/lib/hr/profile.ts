// 履歷自行修改：應徵者（/apply/edit/<token>）與員工（/e/<打卡編號>）共用同一筆人員資料（agent_hr_candidates）。
// 人事可手動關閉（identity_locked），或設定開放後幾天自動關閉（hr_settings.profile_edit_days → profile_edit_until）。
// 文件上傳不受此限制。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// 履歷欄位（關閉後不可改）
export const RESUME_FIELDS = ['gender', 'native_place', 'education', 'resume_text'] as const

export function profileOpen(c: { identity_locked?: boolean | null; profile_edit_until?: string | null }, now = Date.now()) {
  if (c.identity_locked) return false
  return !c.profile_edit_until || new Date(c.profile_edit_until).getTime() > now
}

// 依公司設定計算自動關閉時間；0 天＝不自動關閉
export async function openUntil(admin: Admin, ownerId: string): Promise<string | null> {
  const { data } = await admin.from('hr_settings').select('profile_edit_days').eq('owner_id', ownerId).maybeSingle()
  const days = Number(data?.profile_edit_days ?? 0)
  return days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null
}

// 人事開放／關閉某人的履歷修改
export async function setProfileEdit(admin: Admin, ownerId: string, candidateId: string, open: boolean) {
  const patch = open
    ? { identity_locked: false, profile_edit_until: await openUntil(admin, ownerId) }
    : { identity_locked: true }
  return admin.from('agent_hr_candidates').update(patch).eq('id', candidateId).eq('user_id', ownerId)
    .select('id, identity_locked, profile_edit_until').single()
}

// 員工對應的人員資料；沒有時建立（應徵時的資料與文件即掛在這筆上）
export async function candidateForEmployee(
  admin: Admin, ownerId: string,
  emp: { id: string; name: string; store?: string | null; staff_category?: string | null; phone?: string | null; email?: string | null },
  create: boolean,
): Promise<string | null> {
  const { data } = await admin.from('agent_hr_candidates').select('id')
    .eq('user_id', ownerId).eq('hired_employee_id', emp.id).order('created_at').limit(1).maybeSingle()
  if (data || !create) return data?.id ?? null
  const { data: c } = await admin.from('agent_hr_candidates').insert({
    user_id: ownerId, name: emp.name, stage: 'hired', hired_employee_id: emp.id,
    store: emp.store ?? '', staff_category: emp.staff_category ?? '', phone: emp.phone ?? '', email: emp.email ?? '',
    source: 'portal', profile_edit_until: await openUntil(admin, ownerId),
  }).select('id').single()
  return c?.id ?? null
}

// 人員資料（應徵者）變更後同步到已錄用員工：姓名、聯絡方式、生日、身分證
const EMP_SYNC = ['name', 'phone', 'email', 'address', 'birthday', 'id_number'] as const
export async function syncCandidateToEmployee(admin: Admin, ownerId: string, candidateId: string, updates: Record<string, unknown>) {
  const empUp: Record<string, unknown> = {}
  for (const f of EMP_SYNC) {
    if (updates[f] === undefined) continue
    if (f === 'birthday') empUp[f] = updates[f] || null
    else if (f === 'name') { if (String(updates[f] ?? '').trim()) empUp[f] = String(updates[f]).trim() }
    else empUp[f] = String(updates[f] ?? '')
  }
  if (!Object.keys(empUp).length) return
  const { data: c } = await admin.from('agent_hr_candidates').select('hired_employee_id').eq('id', candidateId).eq('user_id', ownerId).maybeSingle()
  if (!c?.hired_employee_id) return
  await admin.from('hr_employees').update(empUp).eq('id', c.hired_employee_id).eq('owner_id', ownerId)
}
