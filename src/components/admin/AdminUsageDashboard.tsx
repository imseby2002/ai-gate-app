'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  DollarSign, Activity, Zap, Shield, Terminal,
  ArrowDownRight, RefreshCw, Search, ArrowUpDown, Info, Sparkles,
  Layers, MessageSquare, Flame
} from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { type SourceChannel } from '@/lib/ai/token-cost-tracker'

interface ModelStat {
  model_id: string
  display_name: string
  source_channel: SourceChannel
  channel_label: string
  service_module: 'all' | 'roundtable' | 'chat'
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
  roundtableTokens: number
  roundtableCostUsd: number
  roundtableRequests: number
  chatTokens: number
  chatCostUsd: number
  chatRequests: number
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
  channels: Record<SourceChannel, ChannelStat>
  byModelAndSource: ModelStat[]
  dailyTrend: DailyTrendItem[]
}

const CHANNEL_COLORS: Record<SourceChannel, string> = {
  anthropic:  '#f97316', // orange
  google:     '#f43f5e', // rose
  openai:     '#10b981', // emerald
  deepseek:   '#6366f1', // indigo
  openrouter: '#a855f7', // purple
  cliproxy:   '#3b82f6', // blue
  freellm:    '#14b8a6', // teal
  groq:       '#06b6d4', // cyan
}

export function AdminUsageDashboard({ initialData }: { initialData?: AdminUsageData }) {
  const [data, setData] = useState<AdminUsageData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [timeRange, setTimeRange] = useState<string>('all')
  const [selectedService, setSelectedService] = useState<'all' | 'roundtable' | 'chat'>('all')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'cost' | 'tokens' | 'requests'>('cost')
  const [sortDesc, setSortDesc] = useState(true)
  const [testingProxy, setTestingProxy] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  const fetchData = async (range: string, service = selectedService) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/usage-stats?days=${range}&service=${service}`)
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
      fetchData(timeRange, selectedService)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRangeChange = (newRange: string) => {
    setTimeRange(newRange)
    fetchData(newRange, selectedService)
  }

  const handleServiceChange = (service: 'all' | 'roundtable' | 'chat') => {
    setSelectedService(service)
    fetchData(timeRange, service)
  }

  const handleTestProxy = async (target: 'cli-proxy' | 'free-llm') => {
    setTestingProxy(target)
    setTestResult(null)
    try {
      if (target === 'cli-proxy') {
        const res = await fetch('/api/cli-proxy/test', { method: 'POST' })
        const json = await res.json()
        if (json.reply) {
          setTestResult(`✅ CLIProxy 連線成功！回覆：${json.reply.slice(0, 40)}...`)
        } else {
          setTestResult(`⚠️ CLIProxy 測試回傳：${json.error || '未回應'}`)
        }
      } else {
        const res = await fetch('/api/cli-proxy/free-status')
        const json = await res.json()
        if (json.ok) {
          setTestResult(`✅ FreeLLM 連線正常！可用模型：${(json.models || []).slice(0, 3).join(', ')}`)
        } else {
          setTestResult(`⚠️ FreeLLM 測試回傳：${json.error || '連線未就緒'}`)
        }
      }
      // Refresh usage stats
      fetchData(timeRange, selectedService)
    } catch (e) {
      setTestResult(`❌ 測試失敗：${String(e)}`)
    } finally {
      setTestingProxy(null)
    }
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
    return (Object.entries(data.channels) as [SourceChannel, ChannelStat][])
      .filter(([, stat]) => stat.tokens > 0)
      .map(([channel, stat]) => ({
        name: stat.label,
        tokens: stat.total_tokens,
        requests: stat.requests,
        cost: stat.cost_usd,
        color: CHANNEL_COLORS[channel] ?? '#8884d8',
      }))
  }, [data])

  // Trend chart data
  const trendData = useMemo(() => {
    if (!data?.dailyTrend) return []
    return data.dailyTrend.map(d => ({
      date: d.date.slice(5),
      '付費費用 (USD)': Number(d.cost_usd.toFixed(4)),
      '總 Token 數': d.total_tokens,
      '請求次數': d.requests,
    }))
  }, [data])

  const summary = data?.summary
  const channels = data?.channels

  return (
    <div className="space-y-6">
      {/* ── Top Header & Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
              總管理後台
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              全平台 AI 使用量、圓桌會議、原廠直連與免費代理核算中心
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-foreground mt-1">
            平台 AI Token 使用量與成本核算中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            完整統計「圓桌會議」與「智慧對話」之全量 Token 消耗；精確區分 Google / Claude / OpenAI 原廠直連、OpenRouter 與 FreeLLM / CLIProxy 免費代理
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
            onClick={() => fetchData(timeRange, selectedService)}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-muted text-muted-foreground transition-colors"
            title="重新整理數據"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 業務模組選擇列（圓桌會議 vs 智慧對話）────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-xs text-indigo-200 font-semibold uppercase tracking-wider">業務模組獨立核算</div>
            <div className="text-base font-bold">查看特定業務之 Token 與費用分佈</div>
          </div>
        </div>

        <div className="inline-flex items-center bg-white/10 p-1 rounded-xl text-xs font-medium backdrop-blur-sm self-start sm:self-auto">
          {[
            { id: 'all',         label: '全部業務', count: `${formatTokens(summary?.totalTokens ?? 0)} Tokens` },
            { id: 'roundtable',  label: '🏛️ AI 圓桌會議', count: `${formatTokens(summary?.roundtableTokens ?? 0)} Tokens` },
            { id: 'chat',        label: '💬 智慧對話', count: `${formatTokens(summary?.chatTokens ?? 0)} Tokens` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleServiceChange(tab.id as 'all' | 'roundtable' | 'chat')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedService === tab.id
                  ? 'bg-white text-slate-900 font-bold shadow'
                  : 'text-slate-200 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                {tab.count}
              </span>
            </button>
          ))}
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

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground self-center mr-1">模型：</span>
              {['Gemini 3 Flash', 'Kimi K2.5', 'GPT-5.4 Mini', 'Grok 3 Mini', 'GPT-5.5'].map(m => (
                <span key={m} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100/70 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                  {m}
                </span>
              ))}
            </div>

            <button
              onClick={() => handleTestProxy('cli-proxy')}
              disabled={testingProxy !== null}
              className="text-xs px-2.5 py-1 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-card text-blue-700 dark:text-blue-300 hover:bg-blue-50 transition-colors shrink-0 flex items-center gap-1"
            >
              {testingProxy === 'cli-proxy' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              連線測試
            </button>
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

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground self-center mr-1">模型：</span>
              {['Llama 3.3 70B', 'GLM 4.7 Flash', 'Qwen 3 32B', 'Auto 智能分流'].map(m => (
                <span key={m} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  {m}
                </span>
              ))}
            </div>

            <button
              onClick={() => handleTestProxy('free-llm')}
              disabled={testingProxy !== null}
              className="text-xs px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-card text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 transition-colors shrink-0 flex items-center gap-1"
            >
              {testingProxy === 'free-llm' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              連線測試
            </button>
          </div>
        </div>
      </div>

      {/* Test result toast alert */}
      {testResult && (
        <div className="p-3 bg-slate-100 dark:bg-muted border rounded-xl text-xs flex items-center justify-between">
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

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
            約 NT$ {Math.round(summary?.totalCostTwd ?? 0).toLocaleString()}（原廠直連計費）
          </div>
        </div>

        {/* 全平台總 Token 數 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">全平台 Token 總量</span>
            <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {formatTokens(summary?.totalTokens ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            圓桌 {formatTokens(summary?.roundtableTokens ?? 0)} / 對話 {formatTokens(summary?.chatTokens ?? 0)}
          </div>
        </div>

        {/* 總調用請求數 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">總調用請求數</span>
            <div className="h-8 w-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {summary?.totalRequests ?? 0} <span className="text-sm font-normal text-muted-foreground">次</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            圓桌 {summary?.roundtableRequests ?? 0} 次 / 對話 {summary?.chatRequests ?? 0} 次
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

      {/* ── 來源渠道總覽小卡 (8 大渠道全景) ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">來源渠道即時一覽（原廠直連 vs 聚合平台 vs 免費代理）</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {(
            [
              { key: 'anthropic',  label: 'Claude 原廠', color: 'border-orange-200 bg-orange-50/50 text-orange-800' },
              { key: 'google',     label: 'Google 原廠', color: 'border-rose-200 bg-rose-50/50 text-rose-800' },
              { key: 'openai',     label: 'OpenAI 原廠', color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800' },
              { key: 'deepseek',   label: 'DeepSeek 原廠', color: 'border-indigo-200 bg-indigo-50/50 text-indigo-800' },
              { key: 'openrouter', label: 'OpenRouter', color: 'border-purple-200 bg-purple-50/50 text-purple-800' },
              { key: 'cliproxy',   label: 'CLIProxy (免費)', color: 'border-blue-200 bg-blue-50/50 text-blue-800' },
              { key: 'freellm',    label: 'FreeLLM (免費)', color: 'border-teal-200 bg-teal-50/50 text-teal-800' },
              { key: 'groq',       label: 'Groq (免費)', color: 'border-cyan-200 bg-cyan-50/50 text-cyan-800' },
            ] as const
          ).map(c => {
            const chStat = channels?.[c.key]
            return (
              <div key={c.key} className={`rounded-xl border p-3 ${c.color} dark:bg-card dark:border-border`}>
                <div className="text-[11px] font-semibold truncate">{c.label}</div>
                <div className="text-base font-bold mt-1">
                  {formatTokens(chStat?.total_tokens ?? 0)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {chStat?.requests ?? 0} 次 · {chStat?.is_free ? '免費' : formatCost(chStat?.cost_usd ?? 0)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 圖表分析區 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 來源渠道佔比圓餅圖 */}
        <div className="bg-white dark:bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">來源渠道 Token 佔比</h3>
            <span className="text-xs text-muted-foreground">依 Token 總量</span>
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
                  dataKey="tokens"
                  paddingAngle={3}
                >
                  {channelPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${formatTokens(Number(v))} Tokens`, name]}
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
            <h3 className="font-semibold text-sm">每日 Token 消耗與商業支出走勢</h3>
            <span className="text-xs text-muted-foreground">包含圓桌會議與智慧對話</span>
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
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation="left" tickFormatter={(v: number) => formatTokens(v)} />
                <YAxis yAxisId="right" tick={{ fontSize: 11 }} orientation="right" tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <RechartsTooltip />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs">{v}</span>} />
                <Bar yAxisId="left" dataKey="總 Token 數" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="付費費用 (USD)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
                完整呈現 Google / Claude / OpenAI / DeepSeek 原廠直連、OpenRouter 與 FreeLLM / CLIProxy 免費代理之個別 Token 消耗與費用
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
              { id: 'all',        label: '全部來源' },
              { id: 'anthropic',  label: 'Claude 原廠' },
              { id: 'google',     label: 'Google 原廠' },
              { id: 'openai',     label: 'OpenAI 原廠' },
              { id: 'deepseek',   label: 'DeepSeek 原廠' },
              { id: 'openrouter', label: 'OpenRouter' },
              { id: 'cliproxy',   label: 'CLIProxy (免費)' },
              { id: 'freellm',    label: 'FreeLLM (免費)' },
              { id: 'groq',       label: 'Groq (免費)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedChannel(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedChannel === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
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
                <th className="text-center px-3 py-3.5">主要業務</th>
                <th className="text-center px-3 py-3.5">計費型態</th>
                <th
                  onClick={() => { setSortBy('requests'); setSortDesc(sortBy === 'requests' ? !sortDesc : true) }}
                  className="text-right px-4 py-3.5 cursor-pointer hover:text-foreground"
                >
                  <div className="inline-flex items-center gap-1">
                    調用次數
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
                <th className="text-right px-5 py-3.5">佔比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-muted/30">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    沒有符合篩選條件的模型用量記錄
                  </td>
                </tr>
              ) : (
                filteredModels.map((row, idx) => {
                  const isFreeProxy = row.source_channel === 'cliproxy' || row.source_channel === 'freellm'
                  const isGroq = row.source_channel === 'groq'
                  const isOpenRouter = row.source_channel === 'openrouter'

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
                          row.source_channel === 'anthropic'
                            ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300'
                            : row.source_channel === 'google'
                            ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                            : row.source_channel === 'openai'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : row.source_channel === 'openrouter'
                            ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300'
                            : row.source_channel === 'cliproxy'
                            ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300'
                            : row.source_channel === 'freellm'
                            ? 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300'
                            : row.source_channel === 'groq'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300'
                            : 'bg-slate-50 text-slate-800 border-slate-200'
                        }`}>
                          {row.channel_label}
                        </span>
                      </td>

                      {/* 主要業務 */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-muted text-muted-foreground">
                          {row.service_module === 'roundtable' ? '🏛️ 圓桌會議' : row.service_module === 'chat' ? '💬 智慧對話' : '通用'}
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
                        ) : isOpenRouter ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                            OpenRouter
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            原廠商業計費
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
            <strong>核算機制說明：</strong> 本核算中心全面結合「AI 圓桌會議」所有席位多輪辯論、簡報與白皮書報告，以及「智慧對話」的 Token 消耗；Google、Claude、OpenAI、DeepSeek 均以各官方原廠標準費率核算；OpenRouter 採其平台轉發加成計費；FreeLLM 與 CLIProxy 代理為 $0.00 完全免費通道。
          </span>
        </div>
      </div>
    </div>
  )
}
