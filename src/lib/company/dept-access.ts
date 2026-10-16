// 公司內「部門資源」的權限判斷（知識庫、考試）：
//   - 公司負責人（owner）、IT（admin）、平台總管理員：所有部門可管理
//   - 部門負責人（公司角色 manager 且 profiles.units 含該部門）：可管理自己的部門
//   - 其他公司成員：只能檢視／使用（例如讀取知識、參加考試）
// department 為 org-units 的部門鍵（hr / marketing …），'system' 代表全公司，只有公司管理者可管理。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'
import { resolveActiveCompanyId } from '@/lib/company/activeCompany'
import { hasUnit } from '@/lib/org-units'

export interface DeptAccess {
  ok: true
  userId: string
  companyId: string
  admin: ReturnType<typeof createAdminClient>
  isCompanyAdmin: boolean
  isManager: boolean
  units: string[]
  fullName: string
}

export type DeptAccessResult = DeptAccess | { ok: false; status: 401 | 403 }

export async function getDeptAccess(): Promise<DeptAccessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles')
    .select('user_type, email, units, company_id, full_name').eq('id', user.id).single()
  const isSuperAdmin = isSuperAdminUser(user, profile)
  const companyId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)
  if (!companyId) return { ok: false, status: 403 }

  const { data: member } = await admin.from('company_members')
    .select('role').eq('company_id', companyId).eq('member_id', user.id).eq('status', 'active').maybeSingle()
  if (!member && !isSuperAdmin) return { ok: false, status: 403 }

  return {
    ok: true,
    userId: user.id,
    companyId,
    admin,
    isCompanyAdmin: isSuperAdmin || member?.role === 'owner' || member?.role === 'admin',
    isManager: member?.role === 'manager',
    units: (profile?.units as string[] | null) ?? [],
    fullName: (profile?.full_name as string | null) || user.email || '',
  }
}

/** 是否可管理該部門的資源 */
export function canManageDept(access: DeptAccess, department: string): boolean {
  if (access.isCompanyAdmin) return true
  if (department === 'system') return false
  return access.isManager && hasUnit(false, access.units, department)
}

/** 可管理的部門清單（公司管理者回傳 null 表示全部） */
export function managedDepts(access: DeptAccess): string[] | null {
  if (access.isCompanyAdmin) return null
  return access.isManager ? access.units : []
}
