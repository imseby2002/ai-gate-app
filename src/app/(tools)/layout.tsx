import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Zap } from 'lucide-react'
import { BackToMenu } from '@/components/layout/BackToMenu'
import { ToolsUserMenu } from '@/components/layout/ToolsUserMenu'

export const dynamic = 'force-dynamic'

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('display_name,user_type').eq('id', user.id).single()
  const isAdmin = profile?.user_type === 'admin'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Minimal top bar */}
      <header className="h-11 shrink-0 bg-white border-b flex items-center px-4 gap-3">
        <BackToMenu isAdmin={isAdmin} variant="tools" />
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Zap className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-bold text-gray-800">AI GATE</span>
        </div>
        <div className="flex-1" />
        <ToolsUserMenu displayName={profile?.display_name ?? user.email ?? ''} />
      </header>

      {/* Tool content (each tool has its own sub-layout) */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
