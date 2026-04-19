import { createClient } from '@/lib/supabase/server'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { Users, MessageSquare, DollarSign, Activity } from 'lucide-react'

export const runtime = 'edge'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Platform stats
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

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
    { label: '總用戶數', value: String(totalUsers ?? 0), icon: Users, color: 'blue' },
    { label: '員工帳號', value: String(employeeCount ?? 0), icon: Activity, color: 'green' },
    { label: '本月 API 費用', value: formatCost(totalCost), icon: DollarSign, color: 'orange' },
    { label: '本月對話次數', value: String(totalMessages), icon: MessageSquare, color: 'purple' },
  ]

  return (
    <div className="px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
        <p className="text-gray-500 text-sm mt-1">平台整體運作概況</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">本月 Top 5 用量（費用）</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">用戶</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">費用</th>
            </tr>
          </thead>
          <tbody>
            {(topUsers ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-8 text-gray-400">尚無資料</td>
              </tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (topUsers ?? []).slice(0, 5).map((row: any) => (
                <tr key={row.user_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{row.profiles?.full_name ?? '—'}</div>
                    <div className="text-xs text-gray-400">{row.profiles?.email}</div>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCost(row.total_cost_usd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
