import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { AppShell } from '@/components/layout/AppShell'

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

  return (
    <AppShell
      userType={profile.user_type}
      enabledModules={profile.enabled_modules ?? undefined}
      conversations={conversations ?? []}
      profile={profile}
      creditBalance={creditBalance}
      locale={locale}
    >
      {children}
    </AppShell>
  )
}
