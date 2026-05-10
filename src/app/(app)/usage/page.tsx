import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { UsageCharts } from '@/components/usage/UsageCharts'
import { DollarSign, Cpu, MessageSquare } from 'lucide-react'

export default async function UsagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const { data: dailyUsage } = await supabase
    .from('usage_daily')
    .select('*, ai_models(display_name, provider)')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true })

  const { data: byModel } = await supabase.rpc('get_usage_summary', {
    p_user_id: user.id,
    p_days: 30,
  })

  const totalCost = (byModel ?? []).reduce((s: number, r: { total_cost_usd: number }) => s + (r.total_cost_usd ?? 0), 0)
  const totalTokens = (byModel ?? []).reduce((s: number, r: { input_tokens: number; output_tokens: number }) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0)
  const totalMessages = (byModel ?? []).reduce((s: number, r: { message_count: number }) => s + (r.message_count ?? 0), 0)

  // Aggregate daily
  const dailyMap = new Map<string, { date: string; cost: number; messages: number }>()
  for (const row of dailyUsage ?? []) {
    const existing = dailyMap.get(row.date) ?? { date: row.date, cost: 0, messages: 0 }
    existing.cost += row.total_cost_usd ?? 0
    existing.messages += row.message_count ?? 0
    dailyMap.set(row.date, existing)
  }
  const dailyData = Array.from(dailyMap.values())

  const summaryCards = [
    { label: '總費用', value: formatCost(totalCost), sub: '最近 30 天', icon: DollarSign, iconBg: 'bg-emerald-50 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: '總 Token 數', value: formatTokens(totalTokens), sub: '輸入 + 輸出', icon: Cpu, iconBg: 'bg-violet-50 dark:bg-violet-950/50', iconColor: 'text-violet-600 dark:text-violet-400' },
    { label: '對話次數', value: totalMessages.toString(), sub: '所有模型合計', icon: MessageSquare, iconBg: 'bg-blue-50 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">用量統計</h1>
          <p className="text-muted-foreground text-sm mt-1">最近 30 天的 AI 使用量與費用</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryCards.map(s => (
            <div key={s.label} className="bg-card rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <span className="text-sm text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-3xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts (client component) */}
        <UsageCharts dailyData={dailyData} byModel={byModel ?? []} />

        {/* Per-model breakdown table */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">各模型明細</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">模型</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">對話次數</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">輸入 Token</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">輸出 Token</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">費用</th>
                </tr>
              </thead>
              <tbody>
                {(byModel ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground/50">
                      尚無使用記錄
                    </td>
                  </tr>
                ) : (
                  (byModel ?? []).map((row: {
                    model_id: string
                    display_name: string
                    message_count: number
                    input_tokens: number
                    output_tokens: number
                    total_cost_usd: number
                  }) => (
                    <tr key={row.model_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">{row.display_name}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.message_count}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatTokens(row.input_tokens)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatTokens(row.output_tokens)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{formatCost(row.total_cost_usd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {(byModel ?? []).length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-5 py-3">合計</td>
                    <td className="px-5 py-3 text-right tabular-nums">{totalMessages}</td>
                    <td className="px-5 py-3 text-right tabular-nums" colSpan={2}>{formatTokens(totalTokens)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCost(totalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
