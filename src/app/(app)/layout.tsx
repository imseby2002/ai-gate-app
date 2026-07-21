import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

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

  return (
    <AppShell
      userType={profile.user_type}
      enabledModules={profile.enabled_modules ?? undefined}
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
