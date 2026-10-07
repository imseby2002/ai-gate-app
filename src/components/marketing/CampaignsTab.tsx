'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  MapPin, Globe, Sparkles, Plus, Pencil, Trash2, X, Loader2,
  TrendingUp, BarChart3, Calendar, DollarSign, Store, CheckCircle2,
  AlertCircle, ArrowUpRight, ArrowDownRight, Clock, Users, ChevronRight, FileText,
  FileSpreadsheet, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ExcelImportModal, type BulkImportResult } from '@/components/common/ExcelImportModal'
import { type ImportColumn, normalizeDate, normalizeNumber } from '@/lib/excel/universal-import'

const IPOS_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'sales_date',
    label: '銷售日期',
    aliases: ['日期', '銷售日期', '營業日', 'Date', 'Ngày', 'Thời gian', 'sales_date', 'date'],
    required: true,
    example: '2026-09-20',
    description: '西元年月日（如 2026-09-20 或 2026/09/20）',
    transform: (v) => normalizeDate(v),
  },
  {
    key: 'store',
    label: '門市名稱',
    aliases: ['門市', '店名', '門市名稱', '分店', 'Store', 'Chi nhánh', 'Điểm bán', 'store_name'],
    example: '信義旗艦店',
    description: '空值將預設為「全門市」',
  },
  {
    key: 'revenue',
    label: '營業額 (營收)',
    aliases: ['營業額', '營收', '銷售額', '金額', '總額', 'Doanh thu', 'Thành tiền', 'Revenue', 'Total', 'amount'],
    required: true,
    example: 36800,
    transform: (v) => normalizeNumber(v, 0),
  },
  {
    key: 'order_count',
    label: '訂單筆數',
    aliases: ['訂單數', '單數', '筆數', 'Orders', 'Số đơn', 'order_count'],
    example: 185,
    transform: (v) => normalizeNumber(v, 0),
  },
  {
    key: 'cups_sold',
    label: '銷售杯數 (數量)',
    aliases: ['杯數', '數量', '銷售杯數', 'Cups', 'Số lượng', 'Số ly', 'Qty', 'quantity'],
    example: 320,
    transform: (v) => normalizeNumber(v, 0),
  },
  {
    key: 'product_name',
    label: '商品品名 (選填)',
    aliases: ['品名', '商品名稱', '產品名稱', 'Product', 'Tên món', 'Tên hàng', 'product_name'],
    example: '極品厚乳炭焙烏龍',
    description: '若為全店日營業額報表可留空，若為商品銷售明細請填寫品名',
  },
  {
    key: 'product_code',
    label: '商品編號 (選填)',
    aliases: ['商品編號', '代碼', 'Code', 'Mã món', 'Mã hàng'],
    example: 'TEA-001',
  },
  {
    key: 'category',
    label: '商品類別 (選填)',
    aliases: ['類別', '分類', 'Category', 'Nhóm món'],
    example: '厚乳鮮奶茶系列',
  },
]

interface Campaign {
  id: string
  title: string
  channel_type: 'offline' | 'online' | 'hybrid'
  category: string
  store: string
  status: 'draft' | 'planned' | 'active' | 'ended' | 'cancelled'
  start_date: string | null
  end_date: string | null
  budget: number
  actual_spend: number
  counterparty: string
  photo_url: string
  photo_urls: string[]
  note: string
  ai_brief: string
  ai_proposal: Record<string, any>
  target_products: string[]
}

const CHANNEL_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  offline: { label: '實體活動', icon: MapPin, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  online:  { label: '線上促銷', icon: Globe,  color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  hybrid:  { label: '虛實整合', icon: Sparkles, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
}

const CATEGORY_LABELS: Record<string, string> = {
  event: '地推/快閃活動',
  material: '門市展架物料',
  outdoor: '戶外大型廣告',
  partner: '異業聯名合作',
  social_promo: '社群發布促銷',
  delivery_promo: '外送平台優惠',
  member_exclusive: 'VIP會員專享',
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'warning' | 'destructive' }> = {
  draft:     { label: '草案', variant: 'secondary' },
  planned:   { label: '已排程', variant: 'default' },
  active:    { label: '進行中', variant: 'warning' },
  ended:     { label: '已結案', variant: 'success' },
  cancelled: { label: '已取消', variant: 'destructive' },
}

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

export function CampaignsTab() {
  const t = useTranslations('Campaigns')
  // 匯入欄位名稱／說明依介面語言顯示（aliases 保留多語別名供比對）
  const importColumns: ImportColumn[] = IPOS_IMPORT_COLUMNS.map(c => ({
    ...c,
    label: t(`col.${c.key}.label`),
    ...(t.has(`col.${c.key}.desc`) ? { description: t(`col.${c.key}.desc`) } : {}),
    ...(t.has(`col.${c.key}.ex`) ? { example: t(`col.${c.key}.ex`) } : {}),
  }))
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // AI 企劃助理彈窗
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiChannel, setAiChannel] = useState<'offline' | 'online' | 'hybrid'>('offline')
  const [aiCategory, setAiCategory] = useState('event')
  const [aiStore, setAiStore] = useState('')
  const [aiBudget, setAiBudget] = useState('')
  const [aiBrief, setAiBrief] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProposal, setAiProposal] = useState<any>(null)

  // 成效分析彈窗
  const [analyticsTarget, setAnalyticsTarget] = useState<Campaign | null>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // iPOS 業績報表匯入彈窗與狀態
  const [iposModalOpen, setIposModalOpen] = useState(false)
  const [iposStats, setIposStats] = useState<any>(null)

  const loadIposStats = useCallback(async () => {
    try {
      const res = await fetch('/api/mkt/ipos/import')
      const j = await res.json()
      if (j.ok && j.summary) {
        setIposStats(j.summary)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (channelFilter) sp.set('channel_type', channelFilter)
    if (statusFilter) sp.set('status', statusFilter)
    try {
      const res = await fetch('/api/mkt/campaigns?' + sp.toString())
      const j = await res.json()
      setItems(j.items ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [channelFilter, statusFilter])

  useEffect(() => {
    load()
    loadIposStats()
  }, [load, loadIposStats])

  // iPOS 試算表匯入提交
  async function handleIposExcelSubmit(rows: Record<string, unknown>[]): Promise<BulkImportResult> {
    try {
      const res = await fetch('/api/mkt/ipos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, filename: 'ipos_sales_report.xlsx' }),
      })
      const j = await res.json()
      if (!res.ok) {
        return { ok: false, error: j.error || t('importFailed') }
      }
      loadIposStats()
      return {
        ok: true,
        inserted: j.inserted,
        updated: j.updated,
        imported: j.imported,
        skipped: j.skipped,
        errors: j.errors,
      }
    } catch (e: any) {
      return { ok: false, error: e.message || t('serverErr') }
    }
  }

  async function handleSave() {
    if (!editing) return
    if (!String(editing.title ?? '').trim()) {
      setErr(t('needName'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const r = await fetch('/api/mkt/campaigns', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || t('saveFailed'))
        return
      }
      setEditing(null)
      load()
    } catch (e: any) {
      setErr(e.message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return
    await fetch('/api/mkt/campaigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  // 觸發 AI 企劃生成
  async function generateAiPlan() {
    if (!aiTopic.trim()) {
      alert(t('needTopic'))
      return
    }
    setAiGenerating(true)
    try {
      const r = await fetch('/api/mkt/campaigns/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          channel_type: aiChannel,
          category: aiCategory,
          store: aiStore,
          budget: Number(aiBudget) || 0,
          brief: aiBrief,
        }),
      })
      const j = await r.json()
      if (j.ok) {
        setAiProposal(j.proposal)
      } else {
        alert(j.error || t('aiFailed'))
      }
    } catch (e: any) {
      alert(e.message || t('aiFailed'))
    } finally {
      setAiGenerating(false)
    }
  }

  // 採用 AI 企劃並儲存活動
  async function applyAiProposal() {
    if (!aiProposal) return
    setSaving(true)
    try {
      const today = new Date()
      const in7Days = new Date(today.getTime() + 7 * 86400000)
      const r = await fetch('/api/mkt/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiProposal.theme || aiTopic,
          channel_type: aiChannel,
          category: aiCategory,
          store: aiStore,
          status: 'planned',
          start_date: today.toISOString().split('T')[0],
          end_date: in7Days.toISOString().split('T')[0],
          budget: Number(aiBudget) || 0,
          note: aiProposal.mechanics || '',
          ai_brief: aiTopic + (aiBrief ? ` - ${aiBrief}` : ''),
          ai_proposal: aiProposal,
        }),
      })
      if (r.ok) {
        setAiModalOpen(false)
        setAiProposal(null)
        setAiTopic('')
        load()
      } else {
        const j = await r.json()
        alert(j.error || t('saveFailed'))
      }
    } catch (e: any) {
      alert(e.message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // 開啟成效分析
  async function openAnalytics(c: Campaign) {
    setAnalyticsTarget(c)
    setAnalyticsLoading(true)
    setAnalyticsData(null)
    try {
      const res = await fetch(`/api/mkt/campaigns/analytics?campaign_id=${c.id}`)
      const j = await res.json()
      if (j.ok) {
        setAnalyticsData(j.summary)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // 計算活動剩餘天數
  function getRemainingDays(endDateStr: string | null) {
    if (!endDateStr) return null
    const end = new Date(endDateStr + 'T23:59:59')
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const activeCount = items.filter(x => x.status === 'active').length
  const totalBudget = items.reduce((acc, x) => acc + (Number(x.budget) || 0), 0)

  return (
    <div className="space-y-6">
      {/* 頂部數據看板與操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">{t('activeCount')}</div>
            <div className="text-2xl font-bold mt-1 text-primary">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">{t('totalBudget')}</div>
            <div className="text-2xl font-bold mt-1">${fmt(totalBudget)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">{t('totalCount')}</div>
            <div className="text-2xl font-bold mt-1">{items.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <FileText className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* iPOS 門市業績串接與狀態看板 */}
      <div className="p-3.5 rounded-xl border bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-cyan-50/70 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{t('iposDb')}</span>
              {iposStats && iposStats.totalRecords > 0 ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                  {t('iposStats', { n: iposStats.totalRecords, rev: fmt(iposStats.totalRevenue) })}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">{t('noIpos')}</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {iposStats && iposStats.minDate && iposStats.maxDate
                ? t('iposRange', { from: iposStats.minDate, to: iposStats.maxDate, n: iposStats.storeCount })
                : t('iposHint')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
            onClick={() => setIposModalOpen(true)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t('importIpos')}
          </Button>
        </div>
      </div>

      {/* 篩選工具列與按鈕 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-medium"
        >
          <option value="">{t('allChannels')}</option>
          <option value="offline">{t('chOfflineLong')}</option>
          <option value="online">{t('chOnlineLong')}</option>
          <option value="hybrid">{t('chHybridLong')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-medium"
        >
          <option value="">{t('allStatus')}</option>
          <option value="active">{t('status.active')}</option>
          <option value="planned">{t('status.planned')}</option>
          <option value="ended">{t('status.ended')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-semibold"
            onClick={() => {
              setAiProposal(null)
              setAiTopic('')
              setAiModalOpen(true)
            }}
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            {t('aiAssistant')}
          </Button>

          <Button
            size="sm"
            className="gap-1.5 font-semibold"
            onClick={() => {
              setErr('')
              setEditing({
                channel_type: 'offline',
                category: 'event',
                title: '',
                store: '',
                status: 'planned',
                budget: 0,
                start_date: new Date().toISOString().split('T')[0],
                end_date: '',
                note: '',
              })
            }}
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </Button>
        </div>
      </div>

      {/* 活動清單卡片 */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl bg-card/40 border-dashed space-y-2">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div className="font-medium text-muted-foreground">{t('empty')}</div>
          <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(item => {
            const ch = CHANNEL_LABELS[item.channel_type] || CHANNEL_LABELS.offline
            const ChIcon = ch.icon
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned
            const remDays = getRemainingDays(item.end_date)

            return (
              <div
                key={item.id}
                className="rounded-2xl border bg-card overflow-hidden shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {item.photo_url && (
                    <img src={item.photo_url} alt="" className="w-full h-36 object-cover" />
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`gap-1 text-[11px] font-semibold border ${ch.color}`}>
                        <ChIcon className="h-3 w-3" />
                        {t(`channel.${CHANNEL_LABELS[item.channel_type] ? item.channel_type : 'offline'}`)}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {CATEGORY_LABELS[item.category] ? t(`category.${item.category}`) : item.category}
                      </Badge>
                      <Badge variant={st.variant} className="text-[11px] font-semibold">
                        {t(`status.${STATUS_CONFIG[item.status] ? item.status : 'planned'}`)}
                        {item.status === 'active' && remDays !== null && (
                          <span className="ml-1 font-normal opacity-90">
                            {remDays > 0 ? t('daysLeft', { n: remDays }) : t('dueToday')}
                          </span>
                        )}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-bold text-base leading-snug">{item.title}</h3>
                      {item.ai_proposal?.slogan && (
                        <p className="text-xs font-medium text-primary mt-1">
                          ✨ 「{item.ai_proposal.slogan}」
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <div className="flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        <span>{item.store ? t('storeIs', { s: item.store }) : t('allStores')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>{t('budgetIs', { v: fmt(item.budget) })}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1 text-[11px]">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {item.start_date ?? t('now')} ~ {item.end_date ?? t('tbd')}
                        </span>
                      </div>
                    </div>

                    {item.note && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded-lg">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-muted/20 border-t flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold hover:border-primary text-primary"
                    onClick={() => openAnalytics(item)}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    {t('analysis')}
                  </Button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setErr('')
                        setEditing({ ...item })
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 彈窗 1：AI 企劃助理 Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAiModalOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-card border p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">{t('aiTitle')}</h2>
                  <p className="text-xs text-muted-foreground">{t('aiDesc')}</p>
                </div>
              </div>
              <button onClick={() => setAiModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold mb-1 block">{t('topicReq')}</label>
                <Input
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder={t('topicPh')}
                  className="h-10"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('channelLabel')}</label>
                <select
                  value={aiChannel}
                  onChange={e => setAiChannel(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                >
                  <option value="offline">{t('chOfflineLong')}</option>
                  <option value="online">{t('chOnlineLong')}</option>
                  <option value="hybrid">{t('chHybridLong')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('typeLabel')}</label>
                <select
                  value={aiCategory}
                  onChange={e => setAiCategory(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{t(`category.${k}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('targetStore')}</label>
                <Input
                  value={aiStore}
                  onChange={e => setAiStore(e.target.value)}
                  placeholder={t('allStoresPh')}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('budgetPlan')}</label>
                <Input
                  type="number"
                  value={aiBudget}
                  onChange={e => setAiBudget(e.target.value)}
                  placeholder={t('budgetPh')}
                  className="h-9"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold mb-1 block">{t('extraReq')}</label>
                <textarea
                  rows={2}
                  value={aiBrief}
                  onChange={e => setAiBrief(e.target.value)}
                  placeholder={t('extraPh')}
                  className="w-full rounded-lg border border-input bg-card p-2 text-xs"
                />
              </div>
            </div>

            <Button
              onClick={generateAiPlan}
              disabled={aiGenerating}
              className="w-full gap-2 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
            >
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGenerating ? t('aiWorking') : t('aiStart')}
            </Button>

            {/* AI 產出預覽 */}
            {aiProposal && (
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-3.5 mt-4 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">✨ {t('aiDraft')}</span>
                  <Badge variant="outline" className="text-[10px]">{t('readyToUse')}</Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-base font-bold text-purple-950 dark:text-purple-100">{aiProposal.theme}</div>
                  <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">「{aiProposal.slogan}」</div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">💡 {t('mechanic')}</span>
                    <span className="text-muted-foreground">{aiProposal.mechanics}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">🗣️ {t('script')}</span>
                    <span className="text-muted-foreground">{aiProposal.staff_script}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">📱 {t('social')}</span>
                    <p className="mt-1 text-muted-foreground whitespace-pre-line bg-card/60 p-2.5 rounded-lg border">
                      {aiProposal.social_copy}
                    </p>
                  </div>
                  {Array.isArray(aiProposal.checklist) && (
                    <div>
                      <span className="font-semibold text-foreground">📋 {t('checklist')}</span>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-muted-foreground">
                        {aiProposal.checklist.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiProposal.kpi_target && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                      🎯 {t('kpi')}{aiProposal.kpi_target}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAiProposal(null)}>{t('replan')}</Button>
                  <Button size="sm" className="font-bold gap-1.5" onClick={applyAiProposal} disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t('adopt')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 彈窗 2：手動新增 / 編輯活動 Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-card border p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-lg">{editing.id ? t('editTitle') : t('newTitle')}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">{t('channelLabel')}</label>
                <select
                  value={editing.channel_type ?? 'offline'}
                  onChange={e => setEditing({ ...editing, channel_type: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                >
                  <option value="offline">{t('channel.offline')}</option>
                  <option value="online">{t('channel.online')}</option>
                  <option value="hybrid">{t('channel.hybrid')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('typeLabel')}</label>
                <select
                  value={editing.category ?? 'event'}
                  onChange={e => setEditing({ ...editing, category: e.target.value })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{t(`category.${k}`)}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block">{t('nameReq')}</label>
                <Input
                  value={editing.title ?? ''}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder={t('namePh')}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('statusLabel')}</label>
                <select
                  value={editing.status ?? 'planned'}
                  onChange={e => setEditing({ ...editing, status: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{t(`status.${k}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('storeLabel')}</label>
                <Input
                  value={editing.store ?? ''}
                  onChange={e => setEditing({ ...editing, store: e.target.value })}
                  placeholder={t('allStoresPh')}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('startDate')}</label>
                <Input
                  type="date"
                  value={editing.start_date ?? ''}
                  onChange={e => setEditing({ ...editing, start_date: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('endDate')}</label>
                <Input
                  type="date"
                  value={editing.end_date ?? ''}
                  onChange={e => setEditing({ ...editing, end_date: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('budget')}</label>
                <Input
                  type="number"
                  value={String(editing.budget ?? 0)}
                  onChange={e => setEditing({ ...editing, budget: Number(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">{t('spent')}</label>
                <Input
                  type="number"
                  value={String(editing.actual_spend ?? editing.budget ?? 0)}
                  onChange={e => setEditing({ ...editing, actual_spend: Number(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block">{t('imageUrl')}</label>
                <Input
                  value={editing.photo_url ?? ''}
                  onChange={e => setEditing({ ...editing, photo_url: e.target.value })}
                  placeholder="https://..."
                  className="h-9"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block">{t('notes')}</label>
                <textarea
                  rows={2}
                  value={editing.note ?? ''}
                  onChange={e => setEditing({ ...editing, note: e.target.value })}
                  className="w-full rounded-lg border border-input bg-card p-2 text-xs"
                />
              </div>
            </div>

            {err && <p className="text-xs text-destructive font-medium">{err}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-bold">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 彈窗 3：活動成效比對與分析報告 Modal */}
      {analyticsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAnalyticsTarget(null)}>
          <div
            className="w-full max-w-3xl rounded-2xl bg-card border p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">{t('reportTitle')}</h2>
                  <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
                    {analyticsTarget.title}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('reportDesc')}
                </p>
              </div>
              <button onClick={() => setAnalyticsTarget(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">{t('computing')}</span>
              </div>
            ) : !analyticsData ? (
              <div className="py-16 text-center text-muted-foreground text-sm">{t('noData')}</div>
            ) : (
              <div className="space-y-5">
                {/* 核心增長摘要指標卡 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border bg-card/60">
                    <div className="text-xs text-muted-foreground">{t('periodRevenue')}</div>
                    <div className="text-xl font-bold mt-1 text-foreground">
                      ${fmt(analyticsData.currentPeriod.revenue)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('ordersCups', { o: analyticsData.currentPeriod.orders, c: analyticsData.currentPeriod.cups })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-card/60">
                    <div className="text-xs text-muted-foreground">{t('pop')}</div>
                    <div className={`text-xl font-bold mt-1 flex items-center gap-1 ${
                      analyticsData.growth.popRevenueGrowthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                    }`}>
                      {analyticsData.growth.popRevenueGrowthPct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {analyticsData.growth.popRevenueGrowthPct > 0 ? '+' : ''}{analyticsData.growth.popRevenueGrowthPct}%
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('priorIs', { v: fmt(analyticsData.priorPeriod.revenue) })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-card/60">
                    <div className="text-xs text-muted-foreground">{t('yoy')}</div>
                    <div className={`text-xl font-bold mt-1 flex items-center gap-1 ${
                      analyticsData.growth.yoyRevenueGrowthPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                    }`}>
                      {analyticsData.growth.yoyRevenueGrowthPct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {analyticsData.growth.yoyRevenueGrowthPct > 0 ? '+' : ''}{analyticsData.growth.yoyRevenueGrowthPct}%
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('yoyIs', { v: fmt(analyticsData.yoyPeriod.revenue) })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border bg-card/60">
                    <div className="text-xs text-muted-foreground">{t('roi')}</div>
                    <div className="text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                      {analyticsData.roi.roiPct}%
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('grossIs', { v: fmt(analyticsData.roi.estimatedGrossProfit) })}
                    </div>
                  </div>
                </div>

                {/* 前期、當期與去年同期詳細對照表 */}
                <div className="rounded-xl border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 text-xs font-bold border-b">
                    {t('periodsTitle')}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20 text-muted-foreground border-b">
                        <tr>
                          <th className="py-2 px-3 text-left">{t('thPeriod')}</th>
                          <th className="py-2 px-3 text-left">{t('thRange')}</th>
                          <th className="py-2 px-3 text-right">{t('thRevenue')}</th>
                          <th className="py-2 px-3 text-right">{t('thOrders')}</th>
                          <th className="py-2 px-3 text-right">{t('thCups')}</th>
                          <th className="py-2 px-3 text-right">{t('thAov')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr className="bg-primary/5 font-semibold text-primary">
                          <td className="py-2.5 px-3">{t('rowCurrent')}</td>
                          <td className="py-2.5 px-3">{analyticsData.currentPeriod.from} ~ {analyticsData.currentPeriod.to}</td>
                          <td className="py-2.5 px-3 text-right">${fmt(analyticsData.currentPeriod.revenue)}</td>
                          <td className="py-2.5 px-3 text-right">{t('ordersN', { n: analyticsData.currentPeriod.orders })}</td>
                          <td className="py-2.5 px-3 text-right">{t('cupsN', { n: analyticsData.currentPeriod.cups })}</td>
                          <td className="py-2.5 px-3 text-right">${analyticsData.currentPeriod.aov}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-muted-foreground">{t('rowPrior')}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{analyticsData.priorPeriod.from} ~ {analyticsData.priorPeriod.to}</td>
                          <td className="py-2.5 px-3 text-right">${fmt(analyticsData.priorPeriod.revenue)}</td>
                          <td className="py-2.5 px-3 text-right">{t('ordersN', { n: analyticsData.priorPeriod.orders })}</td>
                          <td className="py-2.5 px-3 text-right">{t('cupsN', { n: analyticsData.priorPeriod.cups })}</td>
                          <td className="py-2.5 px-3 text-right">${analyticsData.priorPeriod.aov}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-muted-foreground">{t('rowYoy')}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{analyticsData.yoyPeriod.from} ~ {analyticsData.yoyPeriod.to}</td>
                          <td className="py-2.5 px-3 text-right">${fmt(analyticsData.yoyPeriod.revenue)}</td>
                          <td className="py-2.5 px-3 text-right">{t('ordersN', { n: analyticsData.yoyPeriod.orders })}</td>
                          <td className="py-2.5 px-3 text-right">{t('cupsN', { n: analyticsData.yoyPeriod.cups })}</td>
                          <td className="py-2.5 px-3 text-right">${analyticsData.yoyPeriod.aov}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 活動後延續力追蹤 (Post-Campaign Lag Analysis) */}
                {analyticsData.postAnalysis ? (
                  <div className="p-4 rounded-xl border bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-bold text-xs text-foreground">{t('postTitle', { n: analyticsData.postAnalysis.days })}</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div>{t('postDaily')}<strong className="text-foreground">${fmt(analyticsData.postAnalysis.dailyAvgRevenue)}</strong></div>
                      <div>{t('postChange')}<strong className={analyticsData.postAnalysis.sustained ? 'text-emerald-600' : 'text-rose-600'}>
                        {analyticsData.postAnalysis.postVsPriorGrowth > 0 ? '+' : ''}{analyticsData.postAnalysis.postVsPriorGrowth}%
                      </strong></div>
                      <div className="sm:col-span-1 col-span-2 text-muted-foreground">
                        {analyticsData.postAnalysis.comment}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{t('postPending')}</span>
                  </div>
                )}

                {/* 每日趨勢明細 */}
                {Array.isArray(analyticsData.currentPeriod.daily) && analyticsData.currentPeriod.daily.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground">{t('dailyCurve')}</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {analyticsData.currentPeriod.daily.map((d: any) => (
                        <div key={d.date} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card border">
                          <span className="font-mono text-muted-foreground">{d.date}</span>
                          <span className="font-medium">{t('cupsOrders', { c: d.cups, o: d.orders })}</span>
                          <span className="font-bold text-foreground">${fmt(d.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 彈窗 4：iPOS 銷售報表試算表匯入 Modal */}
      {iposModalOpen && (
        <ExcelImportModal
          title={t('importTitle')}
          description={t('importDesc')}
          columns={importColumns}
          templateFilename={t('tplFile')}
          sheetName={t('sheet')}
          onClose={() => setIposModalOpen(false)}
          onSuccess={() => {
            loadIposStats()
          }}
          onSubmit={handleIposExcelSubmit}
          extraHelp={[
            t('help1'),
            t('help2'),
            t('help3'),
          ]}
        />
      )}
    </div>
  )
}
