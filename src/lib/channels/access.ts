// 官方帳號的權限判斷：
//   - 公司負責人（owner）、IT（admin）、平台總管理員：全部帳號可新增／修改／刪除，可指定任何模組
//   - 模組負責人（公司角色 manager 且 profiles.units 含該模組）：可新增帳號，只能指定自己負責的模組；
//     只能修改／刪除有用到自己模組的帳號
//   - 其他公司成員：只能看到帳號名稱與狀態（之後各模組選用帳號時用），看不到憑證
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'
import { CHANNEL_MODULES, type ChannelModuleId } from './platforms'

export interface ChannelAccess {
  ok: true
  userId: string
  companyId: string
  admin: ReturnType<typeof createAdminClient>
  /** 可管理所有帳號 */
  isCompanyAdmin: boolean
  /** 身為負責人的模組（isCompanyAdmin 時為全部） */
  managedModules: ChannelModuleId[]
}

export type ChannelAccessResult = ChannelAccess | { ok: false; status: 401 | 403 }

export async function getChannelAccess(): Promise<ChannelAccessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, email, units, company_id').eq('id', user.id).single()
  if (!profile?.company_id) return { ok: false, status: 403 }

  const { data: member } = await admin.from('company_members')
    .select('role')
    .eq('company_id', profile.company_id)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  const isSuperAdmin = isSuperAdminUser(user, profile)
  if (!member && !isSuperAdmin) return { ok: false, status: 403 }

  const isCompanyAdmin = isSuperAdmin || member?.role === 'owner' || member?.role === 'admin'
  const units: string[] = profile.units ?? []
  const managedModules: ChannelModuleId[] = isCompanyAdmin
    ? CHANNEL_MODULES.map(m => m.id)
    : member?.role === 'manager'
      ? CHANNEL_MODULES.filter(m => m.units.some(u => units.includes(u))).map(m => m.id)
      : []

  return { ok: true, userId: user.id, companyId: profile.company_id, admin, isCompanyAdmin, managedModules }
}

/** 是否可修改／刪除這個帳號 */
export function canEditAccount(access: ChannelAccess, modules: string[]): boolean {
  if (access.isCompanyAdmin) return true
  return modules.some(m => (access.managedModules as string[]).includes(m))
}

/**
 * 模組負責人修改帳號的模組清單時，只能增減自己負責的模組；其他模組維持原狀。
 * 回傳最終要存的模組清單。
 */
export function mergeModules(access: ChannelAccess, current: string[], requested: ChannelModuleId[]): string[] {
  if (access.isCompanyAdmin) return [...new Set(requested)]
  const mine = access.managedModules as string[]
  const kept = current.filter(m => !mine.includes(m))
  const added = requested.filter(m => mine.includes(m))
  return [...new Set([...kept, ...added])]
}
