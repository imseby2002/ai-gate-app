import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LayoutGrid, Shield, Sparkles, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Owner 專用控制台：僅限管理者，其他用戶一律導向 /apps（功能選單）
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') redirect('/apps')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-6">

        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-blue-50/80 to-violet-50/60 dark:from-primary/10 dark:via-slate-900/80 dark:to-violet-950/30 p-5 sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-medium text-primary/70 uppercase tracking-wide">Owner 控制台</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {profile?.full_name ?? profile?.email}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">總控台保留給管理者，功能模組請從功能選單進入。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/apps"
            className="card-lift group bg-card rounded-2xl border p-5 shadow-sm flex items-center gap-4"
          >
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">功能選單</div>
              <div className="text-xs text-muted-foreground mt-0.5">對話、助手、圖片／影片生成、各功能模組</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/admin"
            className="card-lift group bg-card rounded-2xl border p-5 shadow-sm flex items-center gap-4"
          >
            <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">管理後台</div>
              <div className="text-xs text-muted-foreground mt-0.5">用戶、權限、連結與系統設定</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

      </div>
    </div>
  )
}
