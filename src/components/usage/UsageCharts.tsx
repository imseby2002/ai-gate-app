'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatCost } from '@/lib/utils/format'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

interface UsageChartsProps {
  dailyData: Array<{ date: string; cost: number; messages: number }>
  byModel: Array<{ model_id: string; display_name: string; total_cost_usd: number; message_count: number }>
}

export function UsageCharts({ dailyData, byModel }: UsageChartsProps) {
  const pieData = byModel
    .filter(m => m.total_cost_usd > 0)
    .map(m => ({ name: m.display_name, value: m.total_cost_usd }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily Cost Bar Chart */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h2 className="font-semibold mb-4">每日費用</h2>
        {dailyData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            尚無資料
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCost(Number(v)), '費用']}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => `日期：${l}`}
              />
              <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Model Pie Chart */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h2 className="font-semibold mb-4">各模型費用分佈</h2>
        {pieData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            尚無資料
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(v: any) => formatCost(Number(v))} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
