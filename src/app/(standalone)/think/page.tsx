import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Brain } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SkillRunner } from '@/components/skills/SkillRunner'

export const dynamic = 'force-dynamic'

export default async function ThinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-900 text-white px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/apps" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-3">
            <ArrowLeft className="h-4 w-4" /> 返回首頁
          </Link>
          <div className="flex items-center gap-2.5">
            <Brain className="h-7 w-7 text-indigo-300" />
            <h1 className="text-2xl font-bold">思維決策</h1>
          </div>
          <p className="text-slate-300 text-sm mt-1.5">用名家思維模型拆解你的決策與難題——不灌雞湯，只給可用的判斷框架</p>
        </div>
      </div>

      <SkillRunner module="chat" title="思維決策" />
    </div>
  )
}
