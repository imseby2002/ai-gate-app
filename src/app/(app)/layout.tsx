import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'

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
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, updated_at, pinned')
    .eq('user_id', user.id)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)

  // Get credit balance for external users
  let creditBalance: number | undefined
  if (profile.user_type === 'external') {
    const { data } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
    creditBalance = data ?? 0
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
    const { data: company } = await supabase
      .from('companies')
      .select('enabled_modules')
      .eq('id', profile.company_id)
      .single()
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
