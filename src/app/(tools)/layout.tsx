import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { ToolsBrand } from '@/components/layout/ToolsBrand'
import { ToolsUserMenu } from '@/components/layout/ToolsUserMenu'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { CollapsibleAppHeader } from '@/components/layout/CollapsibleAppHeader'

export const dynamic = 'force-dynamic'

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 查不到時下面會退回用 email 顯示，畫面不會壞；但查詢失敗要留下錯誤，
  // 否則同樣是無聲失敗、事後完全無從查起。
  const { data: profile, error: profileErr } = await supabase.from('profiles').select('display_name, company_id').eq('id', user.id).single()
  if (profileErr) console.error('[tools-layout] profile 查詢失敗', profileErr)

  const locale = await getLocale()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Minimal top bar */}
      <CollapsibleAppHeader>
        <header className="h-11 shrink-0 bg-white border-b flex items-center px-4 gap-3">
          <ToolsBrand />
          <div className="flex-1" />
          <LanguageSwitcher currentLocale={locale} />
          <ToolsUserMenu displayName={profile?.display_name ?? user.email ?? ''} hasCompany={!!profile?.company_id} />
        </header>
      </CollapsibleAppHeader>

      {/* Tool content (each tool has its own sub-layout) */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
