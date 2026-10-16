// 人事資料 ↔ 系統帳號同步：員工綁定系統帳號（hr_employees.profile_id）後，
// 帳號的單位權限（profiles.units）與門市鎖定（profiles.department）以人事資料為準。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const UNIT_KEYS = ['hr', 'finance', 'rd', 'store', 'affairs', 'audit', 'marketing', 'mkt', 'repair', 'gm']

export function cleanUnits(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map(String).filter(u => UNIT_KEYS.includes(u)))]
}

// 帳號門市鎖定：屬門市單位、勾選只看本店、且有門市代碼時鎖定本店；其餘不鎖定
export function lockedStore(emp: { units?: string[] | null; store?: string | null; store_locked?: boolean | null }): string | null {
  const store = (emp.store ?? '').trim()
  return (emp.units ?? []).includes('store') && emp.store_locked !== false && store ? store : null
}

export async function syncProfileFromEmployee(admin: Admin, emp: { profile_id?: string | null; units?: string[] | null; store?: string | null; store_locked?: boolean | null }) {
  if (!emp.profile_id) return
  await admin.from('profiles')
    .update({ units: emp.units ?? [], department: lockedStore(emp) })
    .eq('id', emp.profile_id)
}

// 在「人員權限指派」改帳號單位或門市時，回寫到綁定的人事資料
export async function syncEmployeeFromProfile(admin: Admin, profileId: string, change: { units?: string[]; storeCode?: string | null }) {
  const patch: Record<string, unknown> = {}
  if (change.units) patch.units = cleanUnits(change.units)
  if (change.storeCode !== undefined) {
    if (change.storeCode) { patch.store = change.storeCode; patch.store_locked = true }
    else patch.store_locked = false
  }
  if (Object.keys(patch).length === 0) return
  await admin.from('hr_employees').update({ ...patch, updated_at: new Date().toISOString() }).eq('profile_id', profileId)
}

// 公司內的系統帳號（公司 owner 名下 profiles.company_id 相同，或為公司有效成員）
export async function companyAccounts(admin: Admin, ownerId: string) {
  const { data: owner } = await admin.from('profiles').select('company_id').eq('id', ownerId).single()
  const cid = owner?.company_id as string | null
  if (!cid) return []
  const { data: members } = await admin.from('company_members').select('member_id').eq('company_id', cid).eq('status', 'active')
  const ids = (members ?? []).map(m => m.member_id).filter(Boolean)
  let q = admin.from('profiles').select('id, full_name, email')
  q = ids.length ? q.or(`company_id.eq.${cid},id.in.(${ids.join(',')})`) : q.eq('company_id', cid)
  const { data } = await q.order('full_name')
  return (data ?? []) as { id: string; full_name: string | null; email: string | null }[]
}

// 綁定前檢查：帳號屬於本公司，且尚未綁定其他員工
export async function checkProfileLink(admin: Admin, ownerId: string, profileId: string, employeeId?: string): Promise<string | null> {
  const accounts = await companyAccounts(admin, ownerId)
  if (!accounts.some(a => a.id === profileId)) return '此系統帳號不屬於本公司'
  let q = admin.from('hr_employees').select('id, name').eq('owner_id', ownerId).eq('profile_id', profileId)
  if (employeeId) q = q.neq('id', employeeId)
  const { data } = await q.limit(1)
  if (data?.length) return `此系統帳號已綁定員工「${data[0].name}」`
  return null
}

// 新綁定帳號時，若人事資料尚未設定單位，先沿用帳號現有的單位與門市鎖定，避免綁定時清掉既有權限
export async function adoptProfileAccess(admin: Admin, profileId: string, units: string[]): Promise<{ units: string[]; store?: string; store_locked?: boolean }> {
  if (units.length) return { units }
  const { data: p } = await admin.from('profiles').select('units, department').eq('id', profileId).single()
  const dept = (p?.department ? String(p.department).trim() : '')
  return {
    units: cleanUnits(p?.units),
    ...(dept ? { store: dept, store_locked: true } : { store_locked: false }),
  }
}
