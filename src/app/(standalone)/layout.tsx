import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { BackToMenu } from '@/components/layout/BackToMenu'
import { ToolsUserMenu } from '@/components/layout/ToolsUserMenu'
import { UpgradePlanBadge } from '@/components/cs/UpgradePlanBadge'
import { CollapsibleAppHeader } from '@/components/layout/CollapsibleAppHeader'

export const dynamic = 'force-dynamic'

export default async function StandaloneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 查不到時下面會退回用 email 顯示，畫面不會壞；但查詢失敗要留下錯誤，
  // 否則同樣是無聲失敗、事後完全無從查起。
  const { data: profile, error: profileErr } = await supabase.from('profiles').select('full_name, company_id').eq('id', user.id).single()
  if (profileErr) console.error('[standalone-layout] profile 查詢失敗', profileErr)

  const locale = await getLocale()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <CollapsibleAppHeader>
        <header className="border-b bg-card px-6 py-3 flex items-center justify-between shrink-0">
          <BackToMenu />
          <div className="flex items-center gap-3">
            <UpgradePlanBadge />
            <LanguageSwitcher currentLocale={locale} />
            <ToolsUserMenu displayName={profile?.full_name ?? user.email ?? ''} hasCompany={!!profile?.company_id} />
          </div>
        </header>
      </CollapsibleAppHeader>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
