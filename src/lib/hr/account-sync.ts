// 人事資料 ↔ 系統帳號同步：員工綁定系統帳號（hr_employees.profile_id）後，
// 帳號的單位權限（profiles.units）與門市鎖定（profiles.department）以人事資料為準。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const UNIT_KEYS = ['hr', 'finance', 'rd', 'store', 'store_leader', 'affairs', 'audit', 'marketing', 'mkt', 'repair', 'gm']

export function cleanUnits(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map(String).filter(u => UNIT_KEYS.includes(u)))]
}

type EmpScope = { units?: string[] | null; store?: string | null; store_locked?: boolean | null; managed_stores?: string[] | null }

export function cleanStores(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map(x => String(x ?? '').trim()).filter(Boolean))]
}

// 帳號可操作的門市：屬門市單位或門市領班、且勾選限定門市時，限定為「管理門市」（未設定則為所屬門市）；其餘不限（空陣列）。
// 門市領班一律限定門市。
export function scopedStores(emp: EmpScope): string[] {
  const units = emp.units ?? []
  const isLeader = units.includes('store_leader')
  if (!units.includes('store') && !isLeader) return []
  if (!isLeader && emp.store_locked === false) return []
  const managed = cleanStores(emp.managed_stores)
  if (managed.length) return managed
  const store = (emp.store ?? '').trim()
  return store ? [store] : []
}

// 相容舊欄位：主要門市（profiles.department）
export function lockedStore(emp: EmpScope): string | null {
  return scopedStores(emp)[0] ?? null
}

export async function syncProfileFromEmployee(admin: Admin, emp: EmpScope & { profile_id?: string | null }) {
  if (!emp.profile_id) return
  const codes = scopedStores(emp)
  await admin.from('profiles')
    .update({ units: emp.units ?? [], department: codes[0] ?? null, store_codes: codes })
    .eq('id', emp.profile_id)
}

// 在「人員權限指派」改帳號單位或門市時，回寫到綁定的人事資料
export async function syncEmployeeFromProfile(admin: Admin, profileId: string, change: { units?: string[]; storeCode?: string | null }) {
  const patch: Record<string, unknown> = {}
  if (change.units) patch.units = cleanUnits(change.units)
  if (change.storeCode !== undefined) {
    if (change.storeCode) { patch.store = change.storeCode; patch.store_locked = true; patch.managed_stores = [change.storeCode] }
    else { patch.store_locked = false; patch.managed_stores = [] }
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
export async function adoptProfileAccess(admin: Admin, profileId: string, units: string[]): Promise<{ units: string[]; store?: string; store_locked?: boolean; managed_stores?: string[] }> {
  if (units.length) return { units }
  const { data: p } = await admin.from('profiles').select('units, department, store_codes').eq('id', profileId).single()
  const codes = cleanStores(p?.store_codes)
  const dept = (p?.department ? String(p.department).trim() : '') || codes[0] || ''
  return {
    units: cleanUnits(p?.units),
    ...(dept ? { store: dept, store_locked: true, managed_stores: codes.length ? codes : [dept] } : { store_locked: false }),
  }
}
