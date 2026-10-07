'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  NotebookPen, Sparkles, Loader2, CheckCircle2, XCircle,
  MessageSquare, Calendar, Plus, Search, Trash2, Copy, Check,
  ExternalLink, Layers, ArrowUpRight, Megaphone, Send, ShieldCheck,
  Palette, Bot, User, Filter, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface LogItem {
  id: string
  type: 'chat' | 'event' | 'manual' | 'summary'
  category: 'ai_chat' | 'skill' | 'campaign' | 'calendar' | 'content' | 'offline' | 'delivery' | 'brand' | 'manual' | 'general'
  title: string
  summary: string
  details?: Record<string, any>
  staff: string
  userId?: string
  status?: string
  credits?: number
  created_at: string
}

interface StaffAgg {
  name: string
  count: number
  chats: number
  events: number
  credits: number
}

interface LogbookData {
  items: LogItem[]
  total: number
  chatCount: number
  eventCount: number
  manualCount: number
  credits: number
  days: number
  byStaff: StaffAgg[]
  byCategory: Record<string, number>
}

const DAYS = [7, 30, 90]
const fmt = (n: number) => Math.round(n * 100) / 100

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ai_chat:   { label: 'AI 對談',     color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Bot },
  skill:     { label: '技能製作',     color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Sparkles },
  campaign:  { label: '行銷活動',     color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: Megaphone },
  calendar:  { label: '社群排程',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Calendar },
  content:   { label: '文案草稿',     color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Layers },
  offline:   { label: '實體宣傳',     color: 'bg-pink-100 text-pink-700 border-pink-200',     icon: Palette },
  delivery:  { label: '外送平台',     color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Send },
  brand:     { label: '品牌設定',     color: 'bg-cyan-100 text-cyan-700 border-cyan-200',     icon: ShieldCheck },
  manual:    { label: '工作紀錄',     color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: NotebookPen },
  general:   { label: '綜合日誌',     color: 'bg-gray-100 text-gray-700 border-gray-200',     icon: NotebookPen },
}

export default function MarketingLogbookPage() {
  const t = useTranslations('MktLogbook')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<LogbookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [report, setReport] = useState('')
  const [gen, setGen] = useState(false)

  // 篩選狀態
  const [activeTab, setActiveTab] = useState<'all' | 'chat' | 'events' | 'manual'>('all')
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState<string>('')

  // 手動新增表單
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newCategory, setNewCategory] = useState('manual')
  const [creating, setCreating] = useState(false)

  // 複製回饋
  const [copiedId, setCopiedId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/marketing/logbook?days=' + days)
      if (r.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      const json = await r.json().catch(() => null)
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  // AI 彙整日誌
  async function genReport() {
    setGen(true)
    setReport('')
    try {
      const r = await fetch('/api/marketing/logbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_report', days })
      })
      const j = await r.json().catch(() => ({}))
      setReport(j.report || j.error || t('genFailed'))
      load() // 重新整理日誌
    } finally {
      setGen(false)
    }
  }

  // 手動建立日誌
  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() && !newSummary.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/marketing/logbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_manual',
          title: newTitle.trim(),
          summary: newSummary.trim(),
          category: newCategory,
        })
      })
      if (res.ok) {
        setNewTitle('')
        setNewSummary('')
        setShowNew(false)
        load()
      } else {
        alert(t('addFailed'))
      }
    } finally {
      setCreating(false)
    }
  }

  // 複製文字
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  // 刪除日誌
  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return
    await fetch('/api/marketing/logbook', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    load()
  }

  // 篩選日誌列表
  const filteredItems = useMemo(() => {
    if (!data?.items) return []
    return data.items.filter(item => {
      // 標籤篩選
      if (activeTab === 'chat' && item.type !== 'chat') return false
      if (activeTab === 'events' && item.type !== 'event') return false
      if (activeTab === 'manual' && item.type !== 'manual' && item.type !== 'summary') return false

      // 同仁篩選
      if (staffFilter && item.staff !== staffFilter) return false

      // 關鍵字搜尋
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = item.title?.toLowerCase().includes(q)
        const matchSummary = item.summary?.toLowerCase().includes(q)
        const matchStaff = item.staff?.toLowerCase().includes(q)
        if (!matchTitle && !matchSummary && !matchStaff) return false
      }

      return true
    })
  }, [data?.items, activeTab, staffFilter, search])

  if (forbidden) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
        {t('noAccess')}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 頁面頂部 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
            <NotebookPen className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('title')}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                {t('subtitle')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {t('desc')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DAYS.map(d => <option key={d} value={d}>{t('lastDays', { n: d })}</option>)}
          </select>

          <button
            onClick={() => setShowNew(v => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </button>

          <button
            onClick={genReport}
            disabled={gen}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('aiReport')}
          </button>
        </div>
      </div>

      {/* 手動新增日誌表單 */}
      {showNew && (
        <form onSubmit={handleCreateManual} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-indigo-950 flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-indigo-600" />
              {t('newTitle')}
            </h3>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              {t('cancel')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <input
                type="text"
                placeholder={t('titlePh')}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manual">{t('cat.manual')}</option>
                <option value="campaign">{t('cat.campaign')}</option>
                <option value="calendar">{t('cat.calendar')}</option>
                <option value="content">{t('cat.content')}</option>
                <option value="offline">{t('cat.offline')}</option>
                <option value="delivery">{t('cat.delivery')}</option>
                <option value="brand">{t('brandRules')}</option>
              </select>
            </div>
          </div>

          <textarea
            placeholder={t('bodyPh')}
            rows={3}
            value={newSummary}
            onChange={e => setNewSummary(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={creating || (!newTitle.trim() && !newSummary.trim())}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* AI 報告預覽 */}
      {report && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              {t('reportTitle')}
            </div>
            <button
              onClick={() => handleCopy('ai_report', report)}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-md border border-indigo-100"
            >
              {copiedId === 'ai_report' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedId === 'ai_report' ? t('reportCopied') : t('copyReport')}
            </button>
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-white/80 p-4 rounded-xl border border-indigo-100/60 font-sans">
            {report}
          </div>
        </div>
      )}

      {/* 數據指標卡片 (KPI) */}
      {loading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500 font-medium">{t('statTotal')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{data.total}</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="text-xs text-violet-600 font-medium flex items-center gap-1">
                <Bot className="h-3.5 w-3.5" /> {t('statChats')}
              </div>
              <div className="mt-1 text-2xl font-bold text-violet-700">{data.chatCount}</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                <Megaphone className="h-3.5 w-3.5" /> {t('statEvents')}
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{data.eventCount}</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {t('statPeople')}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{data.byStaff.length}</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-xs text-gray-500 font-medium">{t('statCredits')}</div>
              <div className="mt-1 text-2xl font-bold text-indigo-600">{fmt(data.credits)}</div>
            </div>
          </div>

          {/* 同仁活躍篩選 */}
          {data.byStaff.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">{t('filterPeople')}</span>
                {staffFilter && (
                  <button
                    onClick={() => setStaffFilter('')}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {t('clearFilter')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.byStaff.map(p => {
                  const active = staffFilter === p.name
                  return (
                    <button
                      key={p.name}
                      onClick={() => setStaffFilter(active ? '' : p.name)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                        active
                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-indigo-700 text-white' : 'bg-white text-gray-500 border'}`}>
                        {p.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 篩選工具列：分類頁籤與搜尋 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center p-1 bg-gray-100 rounded-xl gap-1 text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t('tabAll', { n: data.items.length })}
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  activeTab === 'chat' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                {t('tabChats', { n: data.chatCount })}
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  activeTab === 'events' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Megaphone className="h-3.5 w-3.5" />
                {t('tabEvents', { n: data.eventCount })}
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  activeTab === 'manual' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <NotebookPen className="h-3.5 w-3.5" />
                {t('tabManual', { n: data.manualCount })}
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPh')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 日誌列表 */}
          <div className="space-y-2.5">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
                {t('empty', { n: data.days })}
              </div>
            ) : (
              filteredItems.map(item => {
                const conf = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.general
                const Icon = conf.icon
                const dateStr = new Date(item.created_at).toLocaleString('zh-TW', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const isManual = item.id.startsWith('temp_') || item.type === 'manual' || item.type === 'summary'

                return (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${conf.color}`}>
                          <Icon className="h-3 w-3" />
                          {t(`cat.${CATEGORY_CONFIG[item.category] ? item.category : 'general'}`)}
                        </span>

                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {item.title}
                        </span>

                        {item.status && item.status !== 'completed' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 uppercase">
                            {item.status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-full font-medium">
                          <User className="h-3 w-3 text-indigo-500" />
                          {item.staff}
                        </span>
                        <span className="text-xs text-gray-400">{dateStr}</span>
                        {isManual && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            title={t('delete')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs sm:text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {item.summary || '—'}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        {item.credits !== undefined && item.credits > 0 && (
                          <span className="text-indigo-600 font-medium">
                            {t('credits', { n: fmt(item.credits) })}
                          </span>
                        )}
                        {item.details?.channel && (
                          <span>{t('channel')}{String(item.details.channel).toUpperCase()}</span>
                        )}
                        {item.details?.model && (
                          <span>{t('model')}{item.details.model}</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleCopy(item.id, `${item.title}\n${item.summary}`)}
                        className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600"
                      >
                        {copiedId === item.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedId === item.id ? t('copied') : t('copy')}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
