import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Zap, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('display_name,user_type').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Minimal top bar */}
      <header className="h-11 shrink-0 bg-white border-b flex items-center px-4 gap-3">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首頁
        </Link>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Zap className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-bold text-gray-800">AI GATE</span>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{profile.display_name ?? user.email}</span>
      </header>

      {/* Tool content (each tool has its own sub-layout) */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
