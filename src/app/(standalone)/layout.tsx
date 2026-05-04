import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Zap } from 'lucide-react'

export default async function StandaloneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-6 py-3 flex items-center gap-3 shrink-0">
        <a href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Zap className="h-5 w-5 text-primary" />
          <div className="leading-none">
            <span className="font-bold text-base">AI GATE</span>
            <span className="block text-xs text-muted-foreground mt-0.5">← 返回主選單</span>
          </div>
        </a>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
