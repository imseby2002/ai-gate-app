import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const ACTIVE_COMPANY_COOKIE = 'active_company_id'

// 解析公司 owner 的帳號 id（資料實際歸屬的帳號）。unit-access.ts 與
// marketing/company.ts 原本各自重複實作一份，統一收在這裡。
export async function resolveCompanyOwner(admin: Admin, companyId: string | null): Promise<string | null> {
  if (!companyId) return null
  const { data, error } = await admin.from('company_members')
    .select('member_id').eq('company_id', companyId).eq('role', 'owner').eq('status', 'active').maybeSingle()
  if (error) console.error('[active-company] company_members(owner) 查詢失敗', { companyId, error })
  return data?.member_id ?? null
}

// 解析「目前應該操作哪一家公司」：
// - 有切換 cookie 且該公司確實有 active 成員資格（或本人是總管理員，可代操任一公司）→ 用 cookie 指定的公司
// - 否則退回 profiles.company_id（單一公司員工的預設值，原本行為不變）
// 一個人現在可以同時是多家公司的一般成員（owner 除外，owner 仍一人限一家），
// 所以「目前是哪家」不能只看 profiles.company_id，需要靠切換 cookie 明確指定。
export async function resolveActiveCompanyId(
  admin: Admin,
  userId: string,
  isSuperAdmin: boolean,
  fallbackCompanyId: string | null,
): Promise<string | null> {
  const cookieStore = await cookies()
  const requested = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value

  if (requested) {
    if (isSuperAdmin) return requested
    const { data } = await admin.from('company_members')
      .select('id').eq('company_id', requested).eq('member_id', userId).eq('status', 'active').maybeSingle()
    return data ? requested : fallbackCompanyId
  }

  // 沒有切換 cookie：總管理員維持操作自己的帳號（不套用殘留的 profiles.company_id），
  // 一般使用者才退回自己所屬的預設公司——跟原本行為一致。
  return isSuperAdmin ? null : fallbackCompanyId
}
