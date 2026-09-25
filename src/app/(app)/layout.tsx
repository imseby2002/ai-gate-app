import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'
import { getBalance } from '@/lib/skills/billing'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // 查不到多半是查詢或資料本身有問題，不是真的未登入。留下錯誤才追得到原因，
    // 否則只會看到使用者不斷被導回登入頁、完全無從查起。
    console.error('[app-layout] profile 查詢失敗，導回 /login', profileErr)
    redirect('/login')
  }

  // Get recent conversations for sidebar
  const { data: conversations, error: conversationsErr } = await supabase
    .from('conversations')
    .select('id, title, updated_at, pinned')
    .eq('user_id', user.id)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)
  // 失敗時側邊欄只是空的、畫面不會壞，但看起來就像「對話紀錄不見了」，要查得到原因。
  if (conversationsErr) console.error('[app-layout] conversations 查詢失敗', conversationsErr)

  // Get credit balance for external users
  let creditBalance: number | undefined
  if (profile.user_type === 'external') {
    // 公司方案成員顯示公司錢包餘額（見 lib/skills/billing.ts）
    try {
      creditBalance = await getBalance(user.id)
    } catch (creditErr) {
      // 失敗時餘額會顯示成 0，跟「真的沒錢」看起來一模一樣——這是跟錢有關的數字，不能無聲。
      console.error('[app-layout] 餘額查詢失敗', { userId: user.id, error: creditErr })
      creditBalance = 0
    }
  }

  const locale = await getLocale()

  // 依子網域推導系統範圍：chat.im-tourist.com → 'chat'，只顯示該系統的側邊欄連結。
  // （直接以共用 cookie 登入子網域、未經 ?_si= 流程時，sessionStorage 尚無 scope，
  //   若不在此處推導，側邊欄會退回 enabled_modules 而列出所有模組。）
  const hdrs = await headers()
  const host = (hdrs.get('host') || '').split(':')[0].toLowerCase()
  const sub = host.split('.')[0]
  const subScope = SUBDOMAIN_SYSTEM[sub]

  // 公司的 enabled_modules 分開查，不用 PostgREST 的 embed：companies 與 profiles 之間
  // 有三條外鍵（profiles.company_id、companies.bnb_owner_id、companies.created_by），
  // embed 無法判斷該走哪一條，會回 PGRST201 讓「整個 profile 查詢」失敗，連帶把已登入
  // 的使用者當成查無資料導回 /login，與 /login 之間來回跳轉。
  let companyModules: string[] | undefined
  if (profile.company_id) {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('enabled_modules')
      .eq('id', profile.company_id)
      .single()
    // 失敗時會退回個人的 enabled_modules，使用者看到的可用模組默默變成另一組。
    if (companyErr) console.error('[app-layout] companies 查詢失敗', { companyId: profile.company_id, error: companyErr })
    companyModules = company?.enabled_modules ?? undefined
  }

  const effectiveModules = companyModules ?? profile.enabled_modules ?? undefined

  return (
    <AppShell
      userType={profile.user_type}
      enabledModules={effectiveModules}
      scope={subScope}
      conversations={conversations ?? []}
      profile={profile}
      creditBalance={creditBalance}
      locale={locale}
    >
      {children}
    </AppShell>
  )
}
