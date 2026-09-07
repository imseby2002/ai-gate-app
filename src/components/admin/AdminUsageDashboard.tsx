'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  DollarSign, Activity, Zap, Shield, Server, Terminal,
  ArrowDownRight, RefreshCw, Search, ArrowUpDown, Info, Sparkles
} from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/utils/format'

interface ModelStat {
  model_id: string
  display_name: string
  source_channel: 'cliproxy' | 'freellm' | 'groq' | 'direct'
  channel_label: string
  is_free: boolean
  requests: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  cost_twd: number
  saved_usd: number
  saved_twd: number
  cost_share_pct: number
  token_share_pct: number
}

interface ChannelStat {
  requests: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  cost_twd: number
  saved_usd: number
  saved_twd: number
  is_free: boolean
  label: string
  sub_label: string
}

interface UsageSummary {
  totalCostUsd: number
  totalCostTwd: number
  totalSavedUsd: number
  totalSavedTwd: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  freeRequests: number
  freeRatio: number
}

interface DailyTrendItem {
  date: string
  cost_usd: number
  cliproxy_tokens: number
  cliproxy_requests: number
  freellm_tokens: number
  freellm_requests: number
  groq_tokens: number
  groq_requests: number
  direct_tokens: number
  direct_requests: number
  total_tokens: number
  requests: number
}

interface AdminUsageData {
  summary: UsageSummary
  channels: {
    cliproxy: ChannelStat
    freellm: ChannelStat
    groq: ChannelStat
    direct: ChannelStat
  }
  byModelAndSource: ModelStat[]
  dailyTrend: DailyTrendItem[]
}

const PIE_COLORS = {
  cliproxy: '#3b82f6', // blue
  freellm:  '#10b981', // emerald
  groq:     '#06b6d4', // cyan
  direct:   '#f59e0b', // amber
}

export function AdminUsageDashboard({ initialData }: { initialData?: AdminUsageData }) {
  const [data, setData] = useState<AdminUsageData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [timeRange, setTimeRange] = useState<string>('all')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'cost' | 'tokens' | 'requests'>('cost')
  const [sortDesc, setSortDesc] = useState(true)

  const fetchData = async (range: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/usage-stats?days=${range}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Failed to load usage stats:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialData) {
      fetchData(timeRange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRangeChange = (newRange: string) => {
    setTimeRange(newRange)
    fetchData(newRange)
  }

  // Filtered and sorted models
  const filteredModels = useMemo(() => {
    if (!data?.byModelAndSource) return []
    let list = [...data.byModelAndSource]

    if (selectedChannel !== 'all') {
      list = list.filter(m => m.source_channel === selectedChannel)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(m =>
        m.display_name.toLowerCase().includes(q) ||
        m.model_id.toLowerCase().includes(q) ||
        m.channel_label.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      let diff = 0
      if (sortBy === 'cost') diff = a.cost_usd - b.cost_usd
      else if (sortBy === 'tokens') diff = a.total_tokens - b.total_tokens
      else if (sortBy === 'requests') diff = a.requests - b.requests

      return sortDesc ? -diff : diff
    })

    return list
  }, [data, selectedChannel, searchQuery, sortBy, sortDesc])

  // Pie chart data for requests by channel
  const channelPieData = useMemo(() => {
    if (!data?.channels) return []
    return [
      { name: 'CLIProxy (免費)', value: data.channels.cliproxy.requests, color: PIE_COLORS.cliproxy },
      { name: 'FreeLLM (免費)', value: data.channels.freellm.requests, color: PIE_COLORS.freellm },
      { name: 'Groq (免費)', value: data.channels.groq.requests, color: PIE_COLORS.groq },
      { name: '付費直連', value: data.channels.direct.requests, color: PIE_COLORS.direct },
    ].filter(item => item.value > 0)
  }, [data])

  // Trend chart data (show last 14 days or available points)
  const trendData = useMemo(() => {
    if (!data?.dailyTrend) return []
    return data.dailyTrend.map(d => ({
      date: d.date.slice(5), // MM-DD
      '付費費用 (USD)': Number(d.cost_usd.toFixed(4)),
      'CLIProxy 次數': d.cliproxy_requests,
      'FreeLLM 次數': d.freellm_requests,
      'Groq 次數': d.groq_requests,
      '直連次數': d.direct_requests,
      '總 Token 數': d.total_tokens,
    }))
  }, [data])

  const summary = data?.summary
  const channels = data?.channels

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
              總管理後台
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              全模型成本與免費代理專用分析
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-foreground mt-1">
            平台 AI Token 使用量與成本分析
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            即時追蹤各模型與來源渠道（CLIProxy、FreeLLM、Groq、付費直連）之 Token 消耗、商業支出及節省效益
          </p>
        </div>

        {/* Time range filters */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 dark:bg-muted p-1 rounded-xl text-xs font-medium">
            {[
              { id: 'all', label: '全部期間' },
              { id: '90',  label: '近 90 天' },
              { id: '30',  label: '近 30 天' },
              { id: '7',   label: '近 7 天' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => handleRangeChange(r.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  timeRange === r.id
                    ? 'bg-white dark:bg-background text-primary shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchData(timeRange)}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-muted text-muted-foreground transition-colors"
            title="重新整理數據"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 核心專區：FreeLLM 與 CLIProxy 免費代理各有多少 ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CLIProxy Card */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/40 dark:from-blue-950/30 dark:via-card dark:to-sky-950/20 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-foreground text-lg">經由 CLIProxy 代理</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    100% 免費 ($0.00)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Copilot / Kiro / Grok 免費代理通道</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">替公司節省費用</div>
              <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
                {formatCost(channels?.cliproxy.saved_usd ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                約 NT$ {Math.round(channels?.cliproxy.saved_twd ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-blue-100 dark:border-blue-900/40">
            <div>
              <div className="text-xs text-muted-foreground">對話次數</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-foreground mt-0.5">
                {channels?.cliproxy.requests ?? 0} <span className="text-xs font-normal text-muted-foreground">次</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">總 Token 消耗</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-foreground mt-0.5">
                {formatTokens(channels?.cliproxy.total_tokens ?? 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                入 {formatTokens(channels?.cliproxy.input_tokens ?? 0)} / 出 {formatTokens(channels?.cliproxy.output_tokens ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">實際支出成本</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                $0.00
              </div>
              <div className="text-[10px] text-muted-foreground">完全免費通道</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted-foreground self-center mr-1">支援模型：</span>
            {['Gemini 3 Flash', 'Kimi K2.5', 'GPT-5.4 Mini', 'Grok 3 Mini', 'GPT-5.5'].map(m => (
              <span key={m} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100/70 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* FreeLLM Card */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 dark:from-emerald-950/30 dark:via-card dark:to-teal-950/20 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-foreground text-lg">經由 FreeLLM 代理</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    100% 免費 ($0.00)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">12 平台聚合免費用量通道</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">替公司節省費用</div>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {formatCost(channels?.freellm.saved_usd ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                約 NT$ {Math.round(channels?.freellm.saved_twd ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-emerald-100 dark:border-emerald-900/40">
            <div>
              <div className="text-xs text-muted-foreground">對話次數</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-foreground mt-0.5">
                {channels?.freellm.requests ?? 0} <span className="text-xs font-normal text-muted-foreground">次</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">總 Token 消耗</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-foreground mt-0.5">
                {formatTokens(channels?.freellm.total_tokens ?? 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                入 {formatTokens(channels?.freellm.input_tokens ?? 0)} / 出 {formatTokens(channels?.freellm.output_tokens ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">實際支出成本</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                $0.00
              </div>
              <div className="text-[10px] text-muted-foreground">完全免費通道</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted-foreground self-center mr-1">支援模型：</span>
            {['Llama 3.3 70B', 'GLM 4.7 Flash', 'Qwen 3 32B', 'Auto 智能分流'].map(m => (
              <span key={m} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 全平台綜合指標卡 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 實際 API 總支出 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">實際 API 總支出</span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {formatCost(summary?.totalCostUsd ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            約 NT$ {Math.round(summary?.totalCostTwd ?? 0).toLocaleString()}（僅付費直連計費）
          </div>
        </div>

        {/* 全平台總 Token 數 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">全平台 Token 消耗</span>
            <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {formatTokens(summary?.totalTokens ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            輸入 {formatTokens(summary?.totalInputTokens ?? 0)} / 輸出 {formatTokens(summary?.totalOutputTokens ?? 0)}
          </div>
        </div>

        {/* 總對話請求數 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">總對話請求數</span>
            <div className="h-8 w-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {summary?.totalRequests ?? 0} <span className="text-sm font-normal text-muted-foreground">次</span>
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            免費代理率：{summary?.freeRatio ?? 0}% ({summary?.freeRequests ?? 0} 次免費)
          </div>
        </div>

        {/* 累積為公司節省總金額 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">免費代理累計節省</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCost(summary?.totalSavedUsd ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            約 NT$ {Math.round(summary?.totalSavedTwd ?? 0).toLocaleString()}（FreeLLM + CLIProxy）
          </div>
        </div>
      </div>

      {/* ── 圖表分析區 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 來源渠道佔比圓餅圖 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">來源渠道流量佔比</h3>
            <span className="text-xs text-muted-foreground">依請求次數</span>
          </div>
          {channelPieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
              尚無足夠資料
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={channelPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {channelPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${v} 次`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 每日使用與費用趨勢圖 */}
        <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">每日對話趨勢與支出</h3>
            <span className="text-xs text-muted-foreground">按日期累計</span>
          </div>
          {trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
              尚無日期趨勢資料
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation="left" />
                <YAxis yAxisId="right" tick={{ fontSize: 11 }} orientation="right" tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                <RechartsTooltip />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs">{v}</span>} />
                <Bar yAxisId="left" dataKey="CLIProxy 次數" stackId="req" fill={PIE_COLORS.cliproxy} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="FreeLLM 次數" stackId="req" fill={PIE_COLORS.freellm} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="Groq 次數" stackId="req" fill={PIE_COLORS.groq} radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="直連次數" stackId="req" fill={PIE_COLORS.direct} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 全模型 × 來源詳細明細表 ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
        {/* Table header & filters */}
        <div className="p-5 border-b space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-foreground text-base">各模型 × 來源渠道 成本與用量明細表</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                完整列出全模型呼叫來源、Token 分佈、實際付費金額與免費代理替公司節省之費用
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋模型名稱或 ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-slate-50 dark:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Channel Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { id: 'all',      label: '全部來源', count: data?.byModelAndSource.length ?? 0 },
              { id: 'cliproxy', label: 'CLIProxy (免費)', count: data?.byModelAndSource.filter(m => m.source_channel === 'cliproxy').length ?? 0, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
              { id: 'freellm',  label: 'FreeLLM (免費)', count: data?.byModelAndSource.filter(m => m.source_channel === 'freellm').length ?? 0, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
              { id: 'groq',     label: 'Groq (免費)', count: data?.byModelAndSource.filter(m => m.source_channel === 'groq').length ?? 0, badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300' },
              { id: 'direct',   label: '付費直連 (商業)', count: data?.byModelAndSource.filter(m => m.source_channel === 'direct').length ?? 0, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedChannel(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedChannel === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50/80 dark:bg-muted/40 text-muted-foreground font-medium">
                <th className="text-left px-5 py-3.5">模型名稱 / ID</th>
                <th className="text-left px-4 py-3.5">使用來源渠道</th>
                <th className="text-center px-3 py-3.5">計費型態</th>
                <th
                  onClick={() => { setSortBy('requests'); setSortDesc(sortBy === 'requests' ? !sortDesc : true) }}
                  className="text-right px-4 py-3.5 cursor-pointer hover:text-foreground"
                >
                  <div className="inline-flex items-center gap-1">
                    對話次數
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-right px-4 py-3.5">輸入 Token</th>
                <th className="text-right px-4 py-3.5">輸出 Token</th>
                <th
                  onClick={() => { setSortBy('tokens'); setSortDesc(sortBy === 'tokens' ? !sortDesc : true) }}
                  className="text-right px-4 py-3.5 cursor-pointer hover:text-foreground"
                >
                  <div className="inline-flex items-center gap-1">
                    總 Token 數
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => { setSortBy('cost'); setSortDesc(sortBy === 'cost' ? !sortDesc : true) }}
                  className="text-right px-4 py-3.5 cursor-pointer hover:text-foreground"
                >
                  <div className="inline-flex items-center gap-1">
                    實際成本 (USD / NT$)
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-right px-4 py-3.5">替公司節省</th>
                <th className="text-right px-5 py-3.5">用量佔比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-muted/30">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    沒有符合篩選條件的模型用量記錄
                  </td>
                </tr>
              ) : (
                filteredModels.map((row, idx) => {
                  const isFreeProxy = row.source_channel === 'cliproxy' || row.source_channel === 'freellm'
                  const isGroq = row.source_channel === 'groq'

                  return (
                    <tr
                      key={`${row.source_channel}-${row.model_id}-${idx}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-muted/20 transition-colors"
                    >
                      {/* 模型名稱 */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900 dark:text-foreground text-sm">
                          {row.display_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {row.model_id}
                        </div>
                      </td>

                      {/* 來源渠道 */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          row.source_channel === 'cliproxy'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                            : row.source_channel === 'freellm'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                            : row.source_channel === 'groq'
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {row.channel_label}
                        </span>
                      </td>

                      {/* 計費型態 */}
                      <td className="px-3 py-3.5 text-center">
                        {isFreeProxy ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                            免費代理 ($0)
                          </span>
                        ) : isGroq ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300">
                            官方免費 ($0)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            商業計費
                          </span>
                        )}
                      </td>

                      {/* 對話次數 */}
                      <td className="px-4 py-3.5 text-right font-medium">
                        {row.requests.toLocaleString()}
                      </td>

                      {/* 輸入 Token */}
                      <td className="px-4 py-3.5 text-right text-muted-foreground">
                        {formatTokens(row.input_tokens)}
                      </td>

                      {/* 輸出 Token */}
                      <td className="px-4 py-3.5 text-right text-muted-foreground">
                        {formatTokens(row.output_tokens)}
                      </td>

                      {/* 總 Token 數 */}
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-foreground">
                        {formatTokens(row.total_tokens)}
                      </td>

                      {/* 實際成本 */}
                      <td className="px-4 py-3.5 text-right">
                        {row.cost_usd > 0 ? (
                          <div>
                            <div className="font-bold text-amber-600 dark:text-amber-400">
                              {formatCost(row.cost_usd)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              NT$ {row.cost_twd.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            $0.00 (免費)
                          </span>
                        )}
                      </td>

                      {/* 替公司節省 */}
                      <td className="px-4 py-3.5 text-right">
                        {row.saved_usd > 0 ? (
                          <div>
                            <div className="font-bold text-blue-600 dark:text-blue-400">
                              +{formatCost(row.saved_usd)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              省 NT$ {Math.round(row.saved_twd).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* 用量佔比 */}
                      <td className="px-5 py-3.5 text-right text-muted-foreground">
                        {row.token_share_pct > 0 ? `${row.token_share_pct}%` : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Notes */}
        <div className="p-4 bg-slate-50 dark:bg-muted/30 border-t flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>計費說明：</strong> FreeLLM API 與 CLIProxy API 均為免費用量代理通道，實際 API 費用為 $0.00；Groq Cloud 目前享有官方免費推論層；付費直連則直接按各大官方（Anthropic、Google、DeepSeek、OpenRouter）商業費率實報實銷。
          </span>
        </div>
      </div>
    </div>
  )
}
