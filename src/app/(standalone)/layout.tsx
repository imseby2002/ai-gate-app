import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { BackToMenu } from '@/components/layout/BackToMenu'
import { ToolsUserMenu } from '@/components/layout/ToolsUserMenu'

export const dynamic = 'force-dynamic'

export default async function StandaloneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const locale = await getLocale()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <BackToMenu variant="standalone" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher currentLocale={locale} />
          <ToolsUserMenu displayName={profile?.display_name ?? user.email ?? ''} />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
