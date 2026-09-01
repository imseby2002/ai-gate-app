import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Zap, Users, BarChart3, Settings, Home, FileText, Link2, Headphones, LifeBuoy, Wrench, Bot, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, email, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') redirect('/apps')

  const navItems = [
    { href: '/admin', label: '總覽', icon: BarChart3 },
    { href: '/admin/companies', label: '公司管理', icon: Building2 },
    { href: '/admin/users', label: '用戶管理', icon: Users },
    { href: '/admin/cs-plans', label: 'CS 方案管理', icon: Headphones },
    { href: '/admin/cs-setup-requests', label: 'CS 協助請求', icon: LifeBuoy },
    { href: '/admin/cs-support-requests', label: 'CS 客製/反映', icon: Wrench },
    { href: '/admin/agents', label: 'Agent 管理', icon: Bot },
    { href: '/admin/models', label: '模型設定', icon: Settings },
    { href: '/admin/usage', label: '使用統計', icon: BarChart3 },
    { href: '/admin/cover-letter-templates', label: '求職信模板', icon: FileText },
    { href: '/admin/links', label: '功能登入連結', icon: Link2 },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin Sidebar */}
      <aside className="w-60 flex flex-col h-full border-r bg-card">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">AI GATE</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">管理後台</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-2 py-3 border-t space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
            返回主介面
          </Link>
          <div className="px-3 py-1 text-xs text-muted-foreground/60 truncate">{profile?.email}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-background">
        {children}
      </main>
    </div>
  )
}
