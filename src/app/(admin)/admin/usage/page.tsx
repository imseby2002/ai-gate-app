import { createClient } from '@/lib/supabase/server'
import { formatCost, formatTokens, formatDate } from '@/lib/utils/format'
import { UsageCharts } from '@/components/usage/UsageCharts'

export default async function AdminUsagePage() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // Platform-wide daily usage
  const { data: dailyRaw } = await supabase
    .from('usage_daily')
    .select('date, model_id, total_cost_usd, message_count, input_tokens, output_tokens')
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true })

  // Per-model totals
  const modelMap = new Map<string, { model_id: string; display_name: string; total_cost_usd: number; message_count: number; input_tokens: number; output_tokens: number }>()
  const dayMap = new Map<string, { date: string; cost: number; messages: number }>()

  for (const row of dailyRaw ?? []) {
    // by model
    const m = modelMap.get(row.model_id) ?? { model_id: row.model_id, display_name: row.model_id, total_cost_usd: 0, message_count: 0, input_tokens: 0, output_tokens: 0 }
    m.total_cost_usd += row.total_cost_usd ?? 0
    m.message_count += row.message_count ?? 0
    m.input_tokens += row.input_tokens ?? 0
    m.output_tokens += row.output_tokens ?? 0
    modelMap.set(row.model_id, m)

    // by day
    const d = dayMap.get(row.date) ?? { date: row.date, cost: 0, messages: 0 }
    d.cost += row.total_cost_usd ?? 0
    d.messages += row.message_count ?? 0
    dayMap.set(row.date, d)
  }

  // Enrich model names
  const { data: models } = await supabase.from('ai_models').select('id, display_name')
  const modelNames = Object.fromEntries((models ?? []).map(m => [m.id, m.display_name]))
  const byModel = Array.from(modelMap.values()).map(m => ({ ...m, display_name: modelNames[m.model_id] ?? m.model_id })).sort((a, b) => b.total_cost_usd - a.total_cost_usd)

  const totalCost = byModel.reduce((s, m) => s + m.total_cost_usd, 0)
  const totalTokens = byModel.reduce((s, m) => s + m.input_tokens + m.output_tokens, 0)
  const totalMessages = byModel.reduce((s, m) => s + m.message_count, 0)

  const dailyData = Array.from(dayMap.values())

  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">平台使用統計</h1>
        <p className="text-gray-500 text-sm mt-1">最近 30 天全平台 AI 使用量</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '總 API 費用', value: formatCost(totalCost) },
          { label: '總 Token 數', value: formatTokens(totalTokens) },
          { label: '總對話次數', value: String(totalMessages) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <UsageCharts dailyData={dailyData} byModel={byModel} />

      {/* Detailed model table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">各模型費用明細</h2>
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
                <th className="text-right px-5 py-3 font-medium text-gray-500">佔比</th>
              </tr>
            </thead>
            <tbody>
              {byModel.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">尚無資料</td></tr>
              ) : byModel.map(row => (
                <tr key={row.model_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{row.display_name}</td>
                  <td className="px-5 py-3 text-right">{row.message_count}</td>
                  <td className="px-5 py-3 text-right">{formatTokens(row.input_tokens)}</td>
                  <td className="px-5 py-3 text-right">{formatTokens(row.output_tokens)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCost(row.total_cost_usd)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {totalCost > 0 ? `${((row.total_cost_usd / totalCost) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
