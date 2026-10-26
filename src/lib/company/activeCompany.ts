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
// - 否則退回 profiles.company_id（單一公司員工的預設值）
// 一個人現在可以同時是多家公司的一般成員（owner 除外，owner 仍一人限一家），
// 所以「目前是哪家」不能只看 profiles.company_id，需要靠切換 cookie 明確指定。
//
// 總管理員也是這套資料控管：沒手動切換時，若本人剛好也是某家公司的真員工
// （profiles.company_id 有值，代表有 active company_members），一樣預設代入
// 那家公司，行為跟一般員工一致——不然總管理員自己測試都要每次手動切換。
// 總管理員多出來的權限只在「有明確切換 cookie 時可以代操任一家公司」（不需
// membership 驗證），不是「預設看自己」。
export async function resolveActiveCompanyId(
  admin: Admin,
  userId: string,
  isSuperAdmin: boolean,
  fallbackCompanyId: string | null,
): Promise<string | null> {
  // profiles.company_id 沒填、但只隸屬一家公司（active）時，以那家公司為預設，
  // 避免員工只讀到自己名下的空資料
  const fallback = async (): Promise<string | null> => {
    if (fallbackCompanyId) return fallbackCompanyId
    const { data, error } = await admin.from('company_members')
      .select('company_id').eq('member_id', userId).eq('status', 'active').limit(2)
    if (error) console.error('[active-company] company_members(member) 查詢失敗', { userId, error })
    return data?.length === 1 ? data[0].company_id : null
  }

  let requested: string | undefined
  try {
    const cookieStore = await cookies()
    requested = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value
  } catch {
    return fallback()
  }

  if (requested) {
    if (isSuperAdmin) return requested
    const { data } = await admin.from('company_members')
      .select('id').eq('company_id', requested).eq('member_id', userId).eq('status', 'active').maybeSingle()
    return data ? requested : fallback()
  }

  return fallback()
}

// 以「使用者 id」計算公司的共用層（扣點、公司方案、社群矩陣資源）用：
// 只有在目前請求的登入者就是該使用者時，才採用右上角切換的公司（需有 active 成員資格）；
// 排程（無請求）或管理員代他人操作時，沿用 profiles.company_id。
export async function resolveUserCompanyId(admin: Admin, userId: string, fallbackCompanyId: string | null): Promise<string | null> {
  let requested: string | undefined
  try {
    requested = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value
  } catch {
    return fallbackCompanyId
  }
  if (!requested || requested === fallbackCompanyId) return fallbackCompanyId
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (user?.id !== userId) return fallbackCompanyId
  } catch {
    return fallbackCompanyId
  }
  const { data } = await admin.from('company_members')
    .select('id').eq('company_id', requested).eq('member_id', userId).eq('status', 'active').maybeSingle()
  return data ? requested : fallbackCompanyId
}
