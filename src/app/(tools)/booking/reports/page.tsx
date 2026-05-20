'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, BedDouble, CalendarDays, DollarSign, Download } from 'lucide-react'

interface ReportData {
  monthly: { month: string; revenue: number; nights: number; bookings: number }[]
  byPlatform: { name: string; revenue: number; bookings: number }[]
  byRoom:     { name: string; revenue: number; bookings: number }[]
  totalRevenue: number; totalNights: number; totalBookings: number; avgPrice: number; year: number
}

const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂', other: '其他',
}
const PIE_COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#a855f7','#84cc16','#fb923c']

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function ReportsPage() {
  const year = new Date().getFullYear()
  const [selYear, setSelYear]   = useState(year)
  const [data, setData]         = useState<ReportData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [chartMode, setChartMode] = useState<'revenue' | 'bookings' | 'nights'>('revenue')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/booking/reports?year=${selYear}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [selYear])

  function exportCSV() {
    if (!data) return
    const rows = [
      ['月份','營收','訂單數','住房晚數'],
      ...data.monthly.map(m => [m.month, m.revenue, m.bookings, m.nights]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `訂單報表_${selYear}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = data ? [
    { label: '交易額', value: `NT$ ${fmt(data.totalRevenue)}`, icon: DollarSign, color: 'text-indigo-600 bg-indigo-50' },
    { label: '平均房價/晚', value: `NT$ ${fmt(data.avgPrice)}`, icon: TrendingUp, color: 'text-sky-600 bg-sky-50' },
    { label: '住房晚數', value: fmt(data.totalNights), icon: BedDouble, color: 'text-emerald-600 bg-emerald-50' },
    { label: '訂單數', value: fmt(data.totalBookings), icon: CalendarDays, color: 'text-amber-600 bg-amber-50' },
  ] : []

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">數據分析總覽</h1>
        <div className="flex items-center gap-2">
          <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> 匯出 CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中…</div>
      ) : !data ? null : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-white rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-gray-500">{k.label}</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900">{k.value}</div>
                </div>
              )
            })}
          </div>

          {/* Monthly Chart */}
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">月度趨勢</h2>
              <div className="flex gap-1">
                {([['revenue','營收'],['bookings','訂單'],['nights','晚數']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setChartMode(k)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${chartMode === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={60}
                  tickFormatter={v => chartMode === 'revenue' ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip formatter={(v) => { const n = Number(v ?? 0); return chartMode === 'revenue' ? `NT$ ${fmt(n)}` : fmt(n) }} />
                <Line dataKey={chartMode} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Platform */}
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">各通路分析</h2>
              {data.byPlatform.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">無資料</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.byPlatform.map(p => ({ ...p, name: PLATFORM_NAMES[p.name] ?? p.name }))}
                      dataKey="revenue" nameKey="name" cx="40%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {data.byPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `NT$ ${fmt(Number(v ?? 0))}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {data.byPlatform.length > 0 && (
                <div className="space-y-1">
                  {data.byPlatform.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {PLATFORM_NAMES[p.name] ?? p.name}
                      </div>
                      <span>{p.bookings} 單 · NT$ {fmt(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By Room */}
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">各房型分析</h2>
              {data.byRoom.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">無資料</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.byRoom} dataKey="revenue" nameKey="name"
                      cx="40%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {data.byRoom.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `NT$ ${fmt(Number(v ?? 0))}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {data.byRoom.length > 0 && (
                <div className="space-y-1">
                  {data.byRoom.map((r, i) => (
                    <div key={r.name} className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[(i + 3) % PIE_COLORS.length]} } />
                        {r.name}
                      </div>
                      <span>{r.bookings} 單 · NT$ {fmt(r.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
