'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, BedDouble, CalendarDays, DollarSign, Download, Percent, Users } from 'lucide-react'

interface ReportData {
  monthly: { month: string; revenue: number; nights: number; bookings: number; occupancyRate: number }[]
  byPlatform: { name: string; revenue: number; bookings: number }[]
  byRoom:     { name: string; revenue: number; bookings: number }[]
  totalRevenue: number; totalNights: number; totalBookings: number; avgPrice: number
  avgStay: number; cancelRate: number; cancelledCount: number; occupancyRate: number; revPAR: number; year: number
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
  const [selYear, setSelYear]     = useState(year)
  const [data, setData]           = useState<ReportData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [chartMode, setChartMode] = useState<'revenue' | 'bookings' | 'nights' | 'occupancyRate'>('revenue')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/booking/reports?year=${selYear}`)
      .then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false))
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
    { label: '交易額',    value: `NT$ ${fmt(data.totalRevenue)}`, icon: DollarSign,  color: 'text-indigo-600 bg-indigo-50' },
    { label: '平均房價',  value: `NT$ ${fmt(data.avgPrice)}`,     icon: TrendingUp,  color: 'text-sky-600 bg-sky-50' },
    { label: '住房率',    value: `${data.occupancyRate}%`,         icon: Percent,     color: 'text-emerald-600 bg-emerald-50' },
    { label: '訂單數',    value: fmt(data.totalBookings),          icon: CalendarDays, color: 'text-amber-600 bg-amber-50' },
    { label: '住房晚數',  value: fmt(data.totalNights),            icon: BedDouble,   color: 'text-purple-600 bg-purple-50' },
    { label: '平均入住晚', value: `${data.avgStay} 晚`,            icon: Users,       color: 'text-rose-600 bg-rose-50' },
    { label: '取消率',    value: `${data.cancelRate}%`,            icon: CalendarDays, color: 'text-gray-600 bg-gray-50' },
    { label: 'RevPAR',   value: `NT$ ${fmt(data.revPAR)}`,        icon: TrendingUp,  color: 'text-cyan-600 bg-cyan-50' },
  ] : []

  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">數據分析總覽</h1>
        <div className="flex items-center gap-2">
          <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">匯出 CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中…</div>
      ) : !data ? null : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-white rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${k.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-gray-500">{k.label}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-gray-900 truncate">{k.value}</div>
                </div>
              )
            })}
          </div>

          {/* Monthly Chart */}
          <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-gray-900">月度趨勢</h2>
              <div className="flex gap-1">
                {([['revenue','營收'],['bookings','訂單'],['nights','晚數'],['occupancyRate','住房率']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setChartMode(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${chartMode === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={55}
                  tickFormatter={v => chartMode === 'revenue' ? `${(v/1000).toFixed(0)}K` : chartMode === 'occupancyRate' ? `${v}%` : String(v)} />
                <Tooltip formatter={(v) => { const n = Number(v ?? 0); return chartMode === 'revenue' ? `NT$ ${fmt(n)}` : chartMode === 'occupancyRate' ? `${n}%` : fmt(n) }} />
                <Line dataKey={chartMode} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: '各通路分析', items: data.byPlatform.map(p => ({ ...p, name: PLATFORM_NAMES[p.name] ?? p.name })), colorOffset: 0 },
              { title: '各房型分析', items: data.byRoom, colorOffset: 3 },
            ].map(({ title, items, colorOffset }) => (
              <div key={title} className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
                <h2 className="font-semibold text-gray-900">{title}</h2>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">無資料</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={items} dataKey="revenue" nameKey="name"
                          cx="50%" cy="50%" outerRadius={70}
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {items.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + colorOffset) % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `NT$ ${fmt(Number(v ?? 0))}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: PIE_COLORS[(i + colorOffset) % PIE_COLORS.length] }} />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <span className="shrink-0 ml-2">{item.bookings} 單 · NT$ {fmt(item.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
