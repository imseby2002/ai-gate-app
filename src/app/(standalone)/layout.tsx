import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { Zap } from 'lucide-react'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { SCOPE_COOKIE, SYSTEMS, isSystemKey } from '@/lib/systems'

export const dynamic = 'force-dynamic'

export default async function StandaloneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  const scope = (await cookies()).get(SCOPE_COOKIE)?.value
  const homeHref = profile?.user_type !== 'admin' && isSystemKey(scope) ? SYSTEMS[scope].home : '/dashboard'

  const locale = await getLocale()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <a href={homeHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Zap className="h-5 w-5 text-primary" />
          <div className="leading-none">
            <span className="font-bold text-base">AI GATE</span>
            <span className="block text-xs text-muted-foreground mt-0.5">← 返回主選單</span>
          </div>
        </a>
        <LanguageSwitcher currentLocale={locale} />
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
