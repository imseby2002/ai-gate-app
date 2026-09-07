import { createClient } from '@/lib/supabase/server'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { Users, MessageSquare, DollarSign, Activity, Shield, MessageSquarePlus, Building2, Sparkles } from 'lucide-react'
import NextLink from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Platform stats
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })

  const { count: employeeCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_type', 'employee')

  // Platform-wide usage last 30 days
  const { data: platformUsage } = await supabase
    .from('usage_daily')
    .select('total_cost_usd, message_count, input_tokens, output_tokens')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])

  const totalCost = platformUsage?.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0) ?? 0
  const totalMessages = platformUsage?.reduce((s, r) => s + (r.message_count ?? 0), 0) ?? 0
  const totalTokens = platformUsage?.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0) ?? 0

  // Top users by cost
  const { data: topUsers } = await supabase
    .from('usage_daily')
    .select('user_id, total_cost_usd, profiles(email, full_name)')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('total_cost_usd', { ascending: false })
    .limit(5)

  const stats = [
    { label: '總用戶數', value: String(totalUsers ?? 0), icon: Users, iconBg: 'bg-blue-50 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: '獨立公司數', value: String(totalCompanies ?? 0), icon: Building2, iconBg: 'bg-indigo-50 dark:bg-indigo-950/50', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: '本月 API 費用', value: formatCost(totalCost), icon: DollarSign, iconBg: 'bg-amber-50 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: '本月對話次數', value: String(totalMessages), icon: MessageSquare, iconBg: 'bg-violet-50 dark:bg-violet-950/50', iconColor: 'text-violet-600 dark:text-violet-400' },
  ]

  const adminLinks = [
    { href: '/admin/companies', label: '公司管理',   desc: '建置獨立公司實體、指派負責人與納入成員', icon: Building2 },
    { href: '/admin/users',    label: '用戶管理',   desc: '管理用戶帳號、類型與模組權限', icon: Users },
    { href: '/admin/models',   label: '模型設定',   desc: '管理 AI 模型與計費配置', icon: Activity },
    { href: '/admin/usage',    label: '用量與成本分析', desc: '全模型 Token 計算、FreeLLM / CLIProxy 免費代理效益與商業費用', icon: DollarSign },
    { href: '/admin/feedback', label: '使用者回饋', desc: '審查回饋、觸發 AI 生成分支', icon: MessageSquarePlus },
  ]

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
            <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">管理後台</h1>
            <p className="text-muted-foreground text-sm mt-0.5">平台整體運作概況</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-card rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.iconBg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Free Proxy Highlight Banner */}
        <NextLink href="/admin/usage" className="block group">
          <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">AI Token 使用量與成本核算中心</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    FreeLLM & CLIProxy 雙免費代理
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  查看各模型使用來源、CLIProxy 與 FreeLLM 個別調用次數、Token 消耗及替公司省下的商業 API 費用
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline self-end sm:self-center shrink-0">
              進入分析中心 →
            </div>
          </div>
        </NextLink>

        {/* Quick Links */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">管理功能</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {adminLinks.map(item => (
              <NextLink key={item.href} href={item.href} className="group bg-card rounded-2xl border p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </NextLink>
            ))}
          </div>
        </div>

        {/* Top Users Table */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">本月 Top 5 用量（費用）</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">用戶</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">費用</th>
              </tr>
            </thead>
            <tbody>
              {(topUsers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-10 text-muted-foreground/50">尚無資料</td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (topUsers ?? []).slice(0, 5).map((row: any) => (
                  <tr key={row.user_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground/60">{row.profiles?.email}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCost(row.total_cost_usd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
