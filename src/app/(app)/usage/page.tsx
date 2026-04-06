import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { UsageCharts } from '@/components/usage/UsageCharts'

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

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">用量統計</h1>
        <p className="text-gray-500 text-sm mt-1">最近 30 天的 AI 使用量與費用</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '總費用', value: formatCost(totalCost), sub: '最近 30 天' },
          { label: '總 Token 數', value: formatTokens(totalTokens), sub: '輸入 + 輸出' },
          { label: '對話次數', value: totalMessages.toString(), sub: '所有模型合計' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts (client component) */}
      <UsageCharts dailyData={dailyData} byModel={byModel ?? []} />

      {/* Per-model breakdown table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">各模型明細</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">模型</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">對話次數</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">輸入 Token</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">輸出 Token</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">費用</th>
              </tr>
            </thead>
            <tbody>
              {(byModel ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
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
                  <tr key={row.model_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">{row.display_name}</td>
                    <td className="px-5 py-3 text-right">{row.message_count}</td>
                    <td className="px-5 py-3 text-right">{formatTokens(row.input_tokens)}</td>
                    <td className="px-5 py-3 text-right">{formatTokens(row.output_tokens)}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatCost(row.total_cost_usd)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {(byModel ?? []).length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3">合計</td>
                  <td className="px-5 py-3 text-right">{totalMessages}</td>
                  <td className="px-5 py-3 text-right" colSpan={2}>{formatTokens(totalTokens)}</td>
                  <td className="px-5 py-3 text-right">{formatCost(totalCost)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
