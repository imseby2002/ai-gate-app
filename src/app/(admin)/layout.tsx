import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Zap, Users, BarChart3, Settings, Home, FileText } from 'lucide-react'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, email, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') redirect('/dashboard')

  const navItems = [
    { href: '/admin', label: '總覽', icon: BarChart3 },
    { href: '/admin/users', label: '用戶管理', icon: Users },
    { href: '/admin/models', label: '模型設定', icon: Settings },
    { href: '/admin/usage', label: '使用統計', icon: BarChart3 },
    { href: '/admin/cover-letter-templates', label: '求職信模板', icon: FileText },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-64 flex flex-col h-full bg-gray-900 text-white">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-700">
          <Zap className="h-6 w-6 text-blue-400" />
          <div>
            <div className="font-bold">AI GATE</div>
            <div className="text-xs text-gray-400">管理後台</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <Home className="h-4 w-4" />
            返回主介面
          </Link>
          <div className="mt-2 text-xs text-gray-500">{profile?.email}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
