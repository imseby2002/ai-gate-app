'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Crown, Search, Plus, Upload, Send, MessageSquare,
  Sparkles, CheckCircle2, X, Loader2, Phone, Mail, Tag,
  Pencil, Trash2, ArrowUpDown, ChevronRight, Copy, Check,
  FileSpreadsheet, Layers, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ExcelImportModal, type BulkImportResult } from '@/components/common/ExcelImportModal'
import { type ImportColumn, normalizeNumber } from '@/lib/excel/universal-import'

const CRM_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'phone',
    label: '手機號碼',
    aliases: ['手機', '電話', '聯絡電話', 'phone', 'mobile', 'sđt', 'so dien thoai', 'tel', 'customer_phone'],
    required: true,
    example: '0912345678',
    description: '會員手機號碼（系統主鍵與識別依據）',
  },
  {
    key: 'name',
    label: '顧客姓名',
    aliases: ['姓名', '顧客姓名', '會員姓名', '客戶名稱', 'name', 'tên', 'tên khách hàng', 'customer_name'],
    example: '王小美',
    description: '顧客姓名或暱稱',
  },
  {
    key: 'tier',
    label: '會員等級',
    aliases: ['等級', '會員等級', '卡別', 'tier', 'level', 'hạng', 'hạng thành viên'],
    example: 'VIP',
    description: 'general(一般), silver(白銀), gold(黃金), vip(VIP), vvip(黑卡)',
  },
  {
    key: 'total_spend',
    label: '累計消費金額',
    aliases: ['累積消費', '消費總額', '總消費', 'total_spend', 'spend', 'doanh thu', 'tiền tích lũy', 'tổng chi tiêu'],
    example: 8500,
    transform: (v) => normalizeNumber(v, 0),
  },
  {
    key: 'order_count',
    label: '消費次數',
    aliases: ['消費次數', '訂單數', '次數', 'order_count', 'orders', 'số lần', 'số đơn'],
    example: 24,
    transform: (v) => normalizeNumber(v, 0),
  },
  {
    key: 'tags',
    label: '顧客標籤',
    aliases: ['標籤', '客群標籤', 'tags', 'nhãn'],
    example: '新品控, 鮮奶茶愛好者',
    description: '可輸入多個特徵，以逗號分隔',
  },
  {
    key: 'email',
    label: '電子信箱',
    aliases: ['信箱', 'email', 'mail', 'hòm thư'],
    example: 'user@example.com',
  },
  {
    key: 'notes',
    label: '備註喜好',
    aliases: ['備註', '喜好', 'notes', 'ghi chú'],
    example: '偏好微冰微糖，常客',
  },
]

interface Customer {
  id: string
  phone: string
  name: string
  email: string
  line_uid: string
  zalo_id: string
  tier: 'general' | 'silver' | 'gold' | 'vip' | 'vvip'
  tags: string[]
  total_spend: number
  order_count: number
  last_order_at: string | null
  notes: string
  created_at: string
}

const TIER_CONFIG: Record<string, { label: string; color: string; badge: 'default' | 'secondary' | 'outline' | 'warning' | 'destructive' }> = {
  general: { label: '一般顧客', color: 'text-muted-foreground bg-muted', badge: 'secondary' },
  silver:  { label: '白銀會員', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300', badge: 'outline' },
  gold:    { label: '黃金會員', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400', badge: 'default' },
  vip:     { label: '👑 尊榮 VIP', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400', badge: 'default' },
  vvip:    { label: '💎 黑卡 VVIP', color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-400', badge: 'destructive' },
}

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

export function CrmTab() {
  const [items, setItems] = useState<Customer[]>([])
  const [summary, setSummary] = useState<any>({ total: 0, vipCount: 0, goldCount: 0, totalCustomerSpend: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [editing, setEditing] = useState<Partial<Customer> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Excel / CSV 批次匯入 Modal
  const [excelModalOpen, setExcelModalOpen] = useState(false)

  // 快速貼上批次匯入 Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [batchImporting, setBatchImporting] = useState(false)

  // VIP 推播通知 Modal
  const [vipPushModalOpen, setVipPushModalOpen] = useState(false)
  const [pushProductName, setPushProductName] = useState('')
  const [pushEndDate, setPushEndDate] = useState('')
  const [pushCustomNote, setPushCustomNote] = useState('')
  const [pushGenerating, setPushGenerating] = useState(false)
  const [pushTemplates, setPushTemplates] = useState<any>(null)
  const [copiedType, setCopiedType] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (tierFilter) sp.set('tier', tierFilter)
    try {
      const res = await fetch('/api/mkt/crm?' + sp.toString())
      const j = await res.json()
      setItems(j.items ?? [])
      if (j.summary) setSummary(j.summary)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, tierFilter])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!editing) return
    if (!String(editing.phone ?? '').trim()) {
      setErr('請填寫手機號碼')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const r = await fetch('/api/mkt/crm', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || '儲存失敗')
        return
      }
      setEditing(null)
      load()
    } catch (e: any) {
      setErr(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('確定刪除此會員資料？')) return
    await fetch('/api/mkt/crm', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  // Excel / CSV 試算表批次匯入處理
  async function handleCrmExcelSubmit(rows: Record<string, unknown>[]): Promise<BulkImportResult> {
    try {
      const res = await fetch('/api/mkt/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: rows, filename: 'crm_customers_import.xlsx' }),
      })
      const j = await res.json()
      if (!res.ok) {
        return { ok: false, error: j.error || '匯入失敗' }
      }
      return {
        ok: true,
        inserted: j.inserted ?? j.count,
        updated: j.updated ?? j.count,
        imported: j.imported ?? j.count,
      }
    } catch (e: any) {
      return { ok: false, error: e.message || '連線伺服器時發生錯誤' }
    }
  }

  // 批次匯入
  async function handleBatchImport() {
    const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      alert('請輸入欲匯入之名單資料')
      return
    }
    setBatchImporting(true)
    const customers = lines.map(line => {
      // 支援格式：手機,姓名,等級 或只有手機
      const parts = line.split(/[,，\t\s]+/)
      return {
        phone: parts[0] || '',
        name: parts[1] || '',
        tier: parts[2] === 'VIP' || parts[2] === 'vip' ? 'vip' : parts[2] === '黃金' ? 'gold' : 'general',
      }
    }).filter(x => x.phone)

    try {
      const r = await fetch('/api/mkt/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      })
      const j = await r.json()
      if (j.ok) {
        alert(`成功匯入 ${j.count} 筆會員資料！`)
        setBatchModalOpen(false)
        setBatchText('')
        load()
      } else {
        alert(j.error || '匯入失敗')
      }
    } catch (e: any) {
      alert(e.message || '匯入失敗')
    } finally {
      setBatchImporting(false)
    }
  }

  // 生成 VIP 推播文案
  async function generateVipPush() {
    if (!pushProductName.trim()) {
      alert('請填寫欲推播之新品名稱')
      return
    }
    setPushGenerating(true)
    try {
      const r = await fetch('/api/mkt/crm/vip-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: pushProductName,
          vip_end_date: pushEndDate,
          custom_note: pushCustomNote,
        }),
      })
      const j = await r.json()
      if (j.ok) {
        setPushTemplates(j)
      } else {
        alert(j.error || '推播生成失敗')
      }
    } catch (e: any) {
      alert(e.message || '推播生成失敗')
    } finally {
      setPushGenerating(false)
    }
  }

  function copyText(txt: string, type: string) {
    navigator.clipboard.writeText(txt)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* 數據指標卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">總會員人數</div>
          <div className="text-2xl font-bold mt-1 text-foreground">{summary.total}</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
            <Crown className="h-3.5 w-3.5" /> VIP 尊榮客群
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
            {summary.vipCount}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">享有新品優先嚐鮮權</div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">黃金會員</div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {summary.goldCount}
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">會員累計貢獻額</div>
          <div className="text-2xl font-bold mt-1 text-primary">
            ${fmt(summary.totalCustomerSpend)}
          </div>
        </div>
      </div>

      {/* CRM 資料整合進程資訊看板 */}
      <div className="p-3.5 rounded-xl border bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-blue-50/60 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 sm:mt-0">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-foreground">現有 CRM 串接模式：Excel / CSV 批次上傳（第一階段）</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              直接支援外部現役 CRM 匯出之試算表拖曳上傳與自動欄位對應；系統已預留第二階段排程自動同步與第三階段 API 直連機制。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            階段一：Excel批次啟用中
          </Badge>
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            階段二/三：自動同步規劃中
          </Badge>
        </div>
      </div>

      {/* 搜尋與操作工具列 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋會員姓名、手機號碼..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-medium"
        >
          <option value="">全部會員等級</option>
          <option value="vip">👑 尊榮 VIP / VVIP</option>
          <option value="gold">黃金會員</option>
          <option value="silver">白銀會員</option>
          <option value="general">一般顧客</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-semibold"
            onClick={() => {
              setPushTemplates(null)
              setVipPushModalOpen(true)
            }}
          >
            <Crown className="h-3.5 w-3.5 text-purple-500" />
            VIP 新品推播
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
            onClick={() => setExcelModalOpen(true)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            匯入 CRM Excel
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs text-muted-foreground"
            onClick={() => setBatchModalOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            純文字貼上
          </Button>

          <Button
            size="sm"
            className="gap-1.5 font-semibold"
            onClick={() => {
              setErr('')
              setEditing({
                tier: 'general',
                phone: '',
                name: '',
                email: '',
                tags: [],
                notes: '',
              })
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            新增會員
          </Button>
        </div>
      </div>

      {/* 會員清單表格 */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-card/40 border-dashed space-y-2">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div className="font-medium text-muted-foreground">尚無符合條件之會員資料</div>
          <p className="text-xs text-muted-foreground/70">您可點選上方「批次匯入」或「新增會員」建置客戶名冊。</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b font-medium">
                <tr>
                  <th className="py-2.5 px-4 text-left">會員姓名 / 手機</th>
                  <th className="py-2.5 px-3 text-left">等級</th>
                  <th className="py-2.5 px-3 text-left">標籤特徵</th>
                  <th className="py-2.5 px-3 text-right">累計消費</th>
                  <th className="py-2.5 px-3 text-right">消費單數</th>
                  <th className="py-2.5 px-3 text-left">最後到店</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(c => {
                  const tConf = TIER_CONFIG[c.tier] || TIER_CONFIG.general
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{c.name || '（未命名）'}</div>
                        <div className="font-mono text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${tConf.color}`}>
                          {tConf.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {Array.isArray(c.tags) && c.tags.length > 0 ? (
                            c.tags.map((tg, idx) => (
                              <span key={idx} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                                #{tg}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        ${fmt(c.total_spend)}
                      </td>

                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {c.order_count} 次
                      </td>

                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {c.last_order_at ? c.last_order_at.split('T')[0] : '尚無紀錄'}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setErr('')
                              setEditing({ ...c })
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 彈窗 1：新增 / 編輯會員 Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div
            className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-lg">{editing.id ? '編輯會員資料' : '新增會員資料'}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">手機號碼 *</label>
                <Input
                  value={editing.phone ?? ''}
                  onChange={e => setEditing({ ...editing, phone: e.target.value })}
                  placeholder="例：0912345678"
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">顧客姓名</label>
                <Input
                  value={editing.name ?? ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="例：王小美"
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">會員等級</label>
                <select
                  value={editing.tier ?? 'general'}
                  onChange={e => setEditing({ ...editing, tier: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs font-medium"
                >
                  {Object.entries(TIER_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">特徵標籤（以逗號分隔）</label>
                <Input
                  value={Array.isArray(editing.tags) ? editing.tags.join(', ') : ''}
                  onChange={e => setEditing({
                    ...editing,
                    tags: e.target.value.split(/[,，]+/).map(s => s.trim()).filter(Boolean),
                  })}
                  placeholder="例：新品控, 鮮奶茶愛好者, 常客"
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">備註說明</label>
                <textarea
                  rows={2}
                  value={editing.notes ?? ''}
                  onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full rounded-lg border border-input bg-card p-2 text-xs"
                />
              </div>
            </div>

            {err && <p className="text-xs text-destructive font-medium">{err}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-bold">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                儲存會員
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 彈窗 2：批次匯入會員 Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBatchModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-card border p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-bold text-lg">批次快速匯入名單</h2>
                <p className="text-xs text-muted-foreground mt-0.5">每行一筆，支援格式：手機號碼 姓名 等級</p>
              </div>
              <button onClick={() => setBatchModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              rows={8}
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              placeholder="0912345678, 陳大明, VIP&#10;0923456789, 林美麗, VIP&#10;0934567890, 張志豪, 黃金"
              className="w-full rounded-lg border border-input bg-card p-3 text-xs font-mono"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setBatchModalOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleBatchImport} disabled={batchImporting} className="gap-1.5 font-bold">
                {batchImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                開始批次匯入
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 彈窗 3：VIP 新品專屬推播訊息生成 Modal */}
      {vipPushModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setVipPushModalOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-card border p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">VIP 專享搶先推播產生器</h2>
                  <p className="text-xs text-muted-foreground">針對 VIP / VVIP 核心顧客，自動生成專屬優先品嚐邀請函與多通訊軟體文案</p>
                </div>
              </div>
              <button onClick={() => setVipPushModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold mb-1 block">即將上市之新品名稱 *</label>
                <Input
                  value={pushProductName}
                  onChange={e => setPushProductName(e.target.value)}
                  placeholder="例：極品厚乳炭焙烏龍"
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">VIP 獨享截止日</label>
                <Input
                  type="date"
                  value={pushEndDate}
                  onChange={e => setPushEndDate(e.target.value)}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">額外專享備註</label>
                <Input
                  value={pushCustomNote}
                  onChange={e => setPushCustomNote(e.target.value)}
                  placeholder="例：報手機贈手工餅乾一份"
                  className="h-9"
                />
              </div>
            </div>

            <Button
              onClick={generateVipPush}
              disabled={pushGenerating}
              className="w-full gap-2 font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              {pushGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              生成 VIP 專屬推播文案
            </Button>

            {pushTemplates && (
              <div className="space-y-4 pt-3 border-t animate-in fade-in-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    👑 目標 VIP 受眾群：{pushTemplates.recipientCount} 位貴賓
                  </span>
                  <Badge variant="outline">點選一鍵複製</Badge>
                </div>

                {/* LINE 範本 */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">LINE 官方帳號推播範本</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyText(pushTemplates.templates.line, 'line')}
                    >
                      {copiedType === 'line' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedType === 'line' ? '已複製' : '複製文案'}
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-card p-3 rounded-lg border">
                    {pushTemplates.templates.line}
                  </pre>
                </div>

                {/* 簡訊 SMS 範本 */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">手機簡訊 (SMS) 精簡範本</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => copyText(pushTemplates.templates.sms, 'sms')}
                    >
                      {copiedType === 'sms' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedType === 'sms' ? '已複製' : '複製文案'}
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-card p-3 rounded-lg border">
                    {pushTemplates.templates.sms}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 彈窗 4：Excel / CSV 智慧匯入 Modal */}
      {excelModalOpen && (
        <ExcelImportModal
          title="匯入 CRM 顧客與 VIP 名冊試算表"
          description="支援 .xlsx, .xls 與 .csv 檔案。系統依據「手機號碼」自動比對並更新現有會員資料（Upsert），無須重複鍵入。"
          columns={CRM_IMPORT_COLUMNS}
          templateFilename="CRM_顧客名冊範本.xlsx"
          sheetName="顧客會員名單"
          onClose={() => setExcelModalOpen(false)}
          onSuccess={() => {
            load()
          }}
          onSubmit={handleCrmExcelSubmit}
          extraHelp={[
            '若外部 CRM 匯出檔欄位名稱不同（如「Phone」、「客戶電話」、「SĐT」），系統具備多語系別名自動對應。',
            '「會員等級」支援填寫 VIP、VVIP、黃金、白銀或一般，系統將自動歸類。',
            '「顧客標籤」可以逗點分隔（如：新品愛好者, 常客, 奶茶控）。',
          ]}
        />
      )}
    </div>
  )
}
