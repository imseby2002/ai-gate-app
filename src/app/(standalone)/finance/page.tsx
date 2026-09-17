'use client'

import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import Link from 'next/link'
import {
  Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, Building2,
  CreditCard, Zap, Wallet, TrendingUp, TrendingDown, ArrowUpCircle,
  ArrowDownCircle, ArrowLeftRight, Landmark, Banknote, PiggyBank,
  BarChart3, Upload, Store, FileText, Truck, FileSpreadsheet,
  Package, Search, AlertTriangle, Layers, Calendar, Filter,
  Settings, ChevronRight, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import { ZeroImportModal } from '@/components/finance/ZeroImportModal'
import { SubjectTree, type SubjectItem, type SubjectFilter } from '@/components/finance/SubjectTree'
import { SubjectManagementModal } from '@/components/finance/SubjectManagementModal'
import { MdbErrorDrawer } from '@/components/finance/MdbErrorDrawer'
import type { ImportColumn } from '@/lib/excel/universal-import'
import type { MdbErrorInfo } from '@/lib/fin/zero-import'

import PnlReport from './PnlReport'
import PricingTab from './PricingTab'

type MainTab = 'cashflow' | 'pricing' | 'pnl'
type SubTab = 'journal' | 'today' | 'month' | 'regular' | 'budget_exp' | 'budget_inc' | 'project'
type FlowType = 'income' | 'expense' | 'transfer'

interface Cashflow {
  id: string
  type: FlowType
  category: string
  category_parent: string
  amount: number
  date: string
  description: string
  notes: string
  pay_coll_name: string
  invoice_no: string
  account_id: string | null
  to_account_id: string | null
  receipt_url: string
  created_at: string
}

interface Account {
  id: string
  name: string
  kind: 'cash' | 'bank' | 'credit' | 'ewallet' | 'other'
  opening_balance: number
  currency: string
  note: string
  archived: boolean
  sort: number
  balance?: number
  created_at: string
}

const CASHFLOW_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'date', label: '日期', required: true, example: '2026-03-01', aliases: ['date', '日期'] },
  { key: 'type', label: '類型', required: true, example: '支出', aliases: ['type', '類型', '收支'] },
  { key: 'category', label: '分類', example: '採購費', aliases: ['category', '分類', '科目'] },
  { key: 'amount', label: '金額', required: true, example: 5000, aliases: ['amount', '金額'] },
  { key: 'description', label: '摘要', example: '辦公室耗材採購', aliases: ['description', '摘要', '說明'] },
  { key: 'account_name', label: '帳戶名稱', example: '零用金', aliases: ['account_name', '帳戶名稱', '帳戶'] },
  { key: 'pay_coll_name', label: '收付人', example: '陳小明', aliases: ['pay_coll_name', '收付人', '對象'] },
]

const fmt = (n: number) => Math.round(n || 0).toLocaleString('zh-TW')

function fmtDateWithDay(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  const day = days[d.getDay()]
  return `${y}/${m}/${date} (${day})`
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function InputEl({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <Input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled} className="h-8 text-sm" />
  )
}

// ─── Cashflow Record Form Modal ───────────────────────────────────
function CashflowFormModal({
  initial,
  accounts,
  subjects,
  onSave,
  onCancel,
  saving
}: {
  initial: Partial<Cashflow>
  accounts: Account[]
  subjects: SubjectItem[]
  onSave: (d: any) => void
  onCancel: () => void
  saving: boolean
}) {
  const [type, setType] = useState<FlowType>(initial.type ?? 'expense')
  const [category, setCategory] = useState(initial.category ?? '')
  const [categoryParent, setCategoryParent] = useState(initial.category_parent ?? '')
  const [amount, setAmount] = useState<number>(initial.amount ?? 0)
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(initial.description ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [payCollName, setPayCollName] = useState(initial.pay_coll_name ?? '')
  const [invoiceNo, setInvoiceNo] = useState(initial.invoice_no ?? '')
  const [accountId, setAccountId] = useState(initial.account_id ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(initial.to_account_id ?? accounts[1]?.id ?? '')
  const [err, setErr] = useState('')

  // 根據收支類別篩選可選科目
  const relevantSubjects = useMemo(() => {
    const targetClass = type === 'income' ? 'income' : 'expense'
    return subjects.filter(s => s.class === targetClass)
  }, [subjects, type])

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catName = e.target.value
    setCategory(catName)
    const found = relevantSubjects.find(s => s.name === catName)
    if (found) setCategoryParent(found.parent_name)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || amount <= 0) {
      setErr('請輸入有效金額')
      return
    }
    if (!date) {
      setErr('請選擇記帳日期')
      return
    }
    if (type === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) {
      setErr('轉帳需指定不同的轉出與轉入帳戶')
      return
    }
    onSave({
      type, category, category_parent: categoryParent,
      amount, date, description, notes,
      pay_coll_name: payCollName, invoice_no: invoiceNo,
      account_id: accountId || null,
      to_account_id: type === 'transfer' ? (toAccountId || null) : null,
      receipt_url: initial.receipt_url ?? ''
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" onClick={onCancel}>
      <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-base">
            {initial.id ? '編輯帳務記錄' : '新增帳務記錄'}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {err && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* 類型切換 */}
          <div>
            <label className="block text-2xs font-medium text-muted-foreground mb-1">交易類型</label>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {(['expense', 'income', 'transfer'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                    type === t
                      ? t === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : t === 'expense'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-blue-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'income' ? '收入 (+)' : t === 'expense' ? '支出 (-)' : '轉帳 (⇄)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">記帳日期 *</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">金額 (NT$) *</label>
              <Input
                type="number"
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value) || 0)}
                placeholder="0"
                required
                className="h-8 text-xs font-mono font-bold text-foreground"
              />
            </div>
          </div>

          {/* 項目與帳戶 */}
          {type === 'transfer' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">轉出帳戶 (從項目) *</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (NT$ {fmt(a.balance ?? 0)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">轉入帳戶 (至項目) *</label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (NT$ {fmt(a.balance ?? 0)})</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">
                  {type === 'income' ? '收款帳戶 (至項目)' : '付款帳戶 (從項目)'}
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">
                  {type === 'income' ? '收入科目 (從項目)' : '支出科目 (至項目)'}
                </label>
                <select
                  value={category}
                  onChange={handleCategorySelect}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  <option value="">-- 選擇科目 --</option>
                  {relevantSubjects.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.parent_name ? `${s.parent_name} > ` : ''}{s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">摘要說明</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例：買茶葉、門市營業額"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">收付人 / 廠商 / 客戶</label>
              <Input
                value={payCollName}
                onChange={e => setPayCollName(e.target.value)}
                placeholder="例：ha、廠商名稱"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">發票號碼</label>
              <Input
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="例：AB12345678"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">詳細備註</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="其他補充說明"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs gap-1">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? '儲存中…' : '確認儲存'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Main Finance Page ────────────────────────────────────────────
export default function FinancePage() {
  const [mainTab, setMainTab] = useState<MainTab>('cashflow')
  const [subTab, setSubTab] = useState<SubTab>('journal')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  // 年月狀態（Zero.Net 風格）
  const [year, setYear] = useState<number>(2026)
  const [month, setMonth] = useState<number>(9)

  // 資料狀態
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [selectedSubject, setSelectedSubject] = useState<SubjectFilter | null>(null)
  const [records, setRecords] = useState<Cashflow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // 錯誤與診斷日誌
  const [importLogs, setImportLogs] = useState<any[]>([])
  const [showErrorDrawer, setShowErrorDrawer] = useState(false)
  const [showZeroImport, setShowZeroImport] = useState(false)
  const [showExcelImport, setShowExcelImport] = useState(false)
  const [showSubjectSettings, setShowSubjectSettings] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Cashflow | null>(null)
  const [savingRecord, setSavingRecord] = useState(false)

  // 搜尋與篩選
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'all' | 'desc' | 'category' | 'payee' | 'notes'>('all')

  const acctMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of accounts) map.set(a.id, a.name)
    return map
  }, [accounts])

  const acctName = useCallback((id?: string | null) => (id ? acctMap.get(id) ?? '' : ''), [acctMap])

  // 載入科目主檔
  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/fin/subjects?book=FT')
      if (res.ok) {
        const d = await res.json()
        setSubjects(d.subjects ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  // 載入帳戶
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/accounts')
      if (res.ok) {
        const d = await res.json()
        setAccounts(d.accounts ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  // 載入匯入錯誤紀錄
  const loadImportLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/fin/import-logs?book=FT')
      if (res.ok) {
        const d = await res.json()
        setImportLogs(d.logs ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  // 載入出納交易流水帳
  const loadCashflow = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/hr/cashflow?year=${year}`
      if (subTab === 'month' || subTab === 'journal') {
        url += `&month=${month}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const d = await res.json()
        setRecords(d.cashflow ?? [])
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [year, month, subTab])

  useEffect(() => {
    fetch('/api/hr/accounts').then(res => setIsAdmin(res.status !== 403))
    loadSubjects()
    loadAccounts()
    loadImportLogs()
  }, [loadSubjects, loadAccounts, loadImportLogs])

  useEffect(() => {
    loadCashflow()
  }, [loadCashflow])

  // 計算左側科目樹的即時金額
  const treeBalances = useMemo(() => {
    const map: Record<string, number> = {}

    // 資產帳戶結餘（來自 accounts balance）
    for (const a of accounts) {
      map[a.name] = a.balance ?? 0
      map[`asset|${a.name}`] = a.balance ?? 0
      map[`asset|現金|${a.name}`] = a.balance ?? 0
      map[`asset|銀行存款|${a.name}`] = a.balance ?? 0
    }

    // 收支當月金額（來自當月 records）
    for (const r of records) {
      const amt = Number(r.amount) || 0
      if (r.type === 'income') {
        if (r.category) {
          map[`income|${r.category_parent}|${r.category}`] = (map[`income|${r.category_parent}|${r.category}`] || 0) + amt
          map[r.category] = (map[r.category] || 0) + amt
        }
      } else if (r.type === 'expense') {
        if (r.category) {
          map[`expense|${r.category_parent}|${r.category}`] = (map[`expense|${r.category_parent}|${r.category}`] || 0) + amt
          map[r.category] = (map[r.category] || 0) + amt
        }
      }
    }

    return map
  }, [accounts, records])

  // 篩選後交易清單
  const filteredRecords = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)

    return records.filter(r => {
      // 子頁籤模式過濾
      if (subTab === 'today' && r.date !== todayStr) return false

      // 左側科目樹選取過濾
      if (selectedSubject) {
        if (selectedSubject.name) {
          const matchCat = r.category === selectedSubject.name
          const matchFromAcct = acctName(r.account_id) === selectedSubject.name
          const matchToAcct = acctName(r.to_account_id) === selectedSubject.name
          if (!matchCat && !matchFromAcct && !matchToAcct) return false
        } else if (selectedSubject.parent_name) {
          const matchParent = r.category_parent === selectedSubject.parent_name
          const matchFromAcct = acctName(r.account_id).includes(selectedSubject.parent_name)
          const matchToAcct = acctName(r.to_account_id).includes(selectedSubject.parent_name)
          if (!matchParent && !matchFromAcct && !matchToAcct) return false
        } else if (selectedSubject.class) {
          if (selectedSubject.class === 'income' && r.type !== 'income') return false
          if (selectedSubject.class === 'expense' && r.type !== 'expense') return false
          if (selectedSubject.class === 'asset' && r.type !== 'transfer' && !r.account_id) return false
        }
      }

      // 搜尋關鍵字過濾
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const fromItem = r.type === 'income' ? r.category : acctName(r.account_id)
        const toItem = r.type === 'expense' ? r.category : r.type === 'transfer' ? acctName(r.to_account_id) : acctName(r.account_id)

        if (searchMode === 'desc') {
          return r.description.toLowerCase().includes(q)
        }
        if (searchMode === 'category') {
          return fromItem.toLowerCase().includes(q) || toItem.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
        }
        if (searchMode === 'payee') {
          return (r.pay_coll_name || '').toLowerCase().includes(q)
        }
        if (searchMode === 'notes') {
          return (r.notes || '').toLowerCase().includes(q) || (r.invoice_no || '').toLowerCase().includes(q)
        }
        // all
        return (
          r.description.toLowerCase().includes(q) ||
          fromItem.toLowerCase().includes(q) ||
          toItem.toLowerCase().includes(q) ||
          (r.pay_coll_name || '').toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q) ||
          (r.invoice_no || '').toLowerCase().includes(q) ||
          String(r.amount).includes(q)
        )
      }

      return true
    })
  }, [records, subTab, selectedSubject, searchQuery, searchMode, acctName])

  // 統計總和
  const monthIncome = useMemo(() => records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0), [records])
  const monthExpense = useMemo(() => records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0), [records])
  const monthBalance = monthIncome - monthExpense

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayIncome = useMemo(() => records.filter(r => r.type === 'income' && r.date === todayStr).reduce((s, r) => s + r.amount, 0), [records, todayStr])
  const todayExpense = useMemo(() => records.filter(r => r.type === 'expense' && r.date === todayStr).reduce((s, r) => s + r.amount, 0), [records, todayStr])

  // 最新匯入紀錄之錯誤
  const latestLog = importLogs[0]
  const allErrors: MdbErrorInfo[] = latestLog?.errors || []
  const totalErrors = allErrors.length

  // 儲存記錄
  const handleSaveRecord = async (data: any) => {
    setSavingRecord(true)
    try {
      if (editingRecord) {
        await fetch('/api/hr/cashflow', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRecord.id, ...data })
        })
      } else {
        await fetch('/api/hr/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      }
      setShowFormModal(false)
      setEditingRecord(null)
      loadCashflow()
      loadAccounts()
    } catch {
      alert('儲存失敗')
    } finally {
      setSavingRecord(false)
    }
  }

  // 刪除記錄
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('確定刪除此筆記錄？')) return
    await fetch('/api/hr/cashflow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    loadCashflow()
    loadAccounts()
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
          <p className="font-semibold">僅出納總務單位可使用出納總務功能</p>
          <p className="text-sm text-gray-400">請以管理者帳號登入後再試</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-3 font-sans h-[calc(100vh-65px)] flex flex-col overflow-hidden">
      {/* 頂部導航與功能模組切換 */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">出納總務系統</h1>
            </div>
            <p className="text-2xs text-muted-foreground">流水帳記帳、樹狀科目、MDB 匯入診斷與物料報表</p>
          </div>
        </div>

        {/* 主功能 Tab 切換 (出納帳務、物料定價、業績報表) */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <button
            onClick={() => setMainTab('cashflow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mainTab === 'cashflow' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            出納帳務
          </button>
          <button
            onClick={() => setMainTab('pricing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mainTab === 'pricing' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            物料定價
          </button>
          <button
            onClick={() => setMainTab('pnl')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mainTab === 'pnl' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            業績損益報表
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/store-expenses">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Store className="h-3.5 w-3.5" />門市費用
            </Button>
          </Link>
          <Link href="/vendors">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Truck className="h-3.5 w-3.5" />廠商資料
            </Button>
          </Link>
        </div>
      </div>

      {mainTab === 'pricing' && (
        <div className="flex-1 overflow-y-auto min-h-0 pt-2">
          <PricingTab />
        </div>
      )}
      {mainTab === 'pnl' && (
        <div className="flex-1 overflow-y-auto min-h-0 pt-2">
          <PnlReport />
        </div>
      )}

      {mainTab === 'cashflow' && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0 pt-2 items-stretch overflow-hidden">
          {/* 左側：科目樹狀結構與年月導覽（Zero.Net 左欄） - 獨立上下捲動 */}
          <div className="h-full min-h-0 overflow-hidden flex flex-col">
            <SubjectTree
              subjects={subjects}
              selected={selectedSubject}
              onSelect={setSelectedSubject}
              year={year}
              setYear={setYear}
              month={month}
              setMonth={setMonth}
              onOpenSubjectSettings={() => setShowSubjectSettings(true)}
              balances={treeBalances}
            />
          </div>

          {/* 右側：帳務小管家核心面板 - 獨立上下捲動 */}
          <div className="h-full min-h-0 min-w-0 flex flex-col space-y-2.5 overflow-hidden">
            {/* 上方子標籤（Zero.Net 子功能分頁） */}
            <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-2 shrink-0">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs overflow-x-auto">
                <button
                  onClick={() => setSubTab('journal')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'journal' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  帳務記錄
                </button>
                <button
                  onClick={() => setSubTab('today')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'today' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  本日收支
                </button>
                <button
                  onClick={() => setSubTab('month')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'month' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  本月收支
                </button>
                <button
                  onClick={() => { setSubTab('regular'); setSelectedSubject({ parent_name: '定期存款' }) }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'regular' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  定期存款
                </button>
                <button
                  onClick={() => setSubTab('project')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'project' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  專案記錄
                </button>
              </div>

              {/* 頂部操作按鈕組 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowSubjectSettings(true)}
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  項目設定
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowZeroImport(true)}
                >
                  <Upload className="h-3.5 w-3.5 text-primary" />
                  匯入記帳檔 (.mdb)
                </Button>

                {totalErrors > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                    onClick={() => setShowErrorDrawer(true)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    匯入錯誤紀錄 ({totalErrors})
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowExcelImport(true)}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  批次匯入
                </Button>

                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 font-semibold"
                  onClick={() => { setEditingRecord(null); setShowFormModal(true) }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增記錄
                </Button>
              </div>
            </div>

            {/* 搜尋列（Zero.Net 風格：輸入框 + 多維度按鈕） */}
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border shrink-0">
              <span className="text-xs font-medium text-muted-foreground shrink-0">資料搜尋：</span>
              <div className="relative flex-1 min-w-[150px]">
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="輸入搜尋關鍵字..."
                  className="h-8 text-xs bg-background"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
                {(['all', 'desc', 'category', 'payee', 'notes'] as const).map(m => {
                  const label = m === 'all' ? '全部' : m === 'desc' ? '摘要' : m === 'category' ? '項目' : m === 'payee' ? '收付人' : '備註發票'
                  return (
                    <Button
                      key={m}
                      size="sm"
                      variant={searchMode === m ? 'default' : 'ghost'}
                      className="h-7 text-2xs px-2"
                      onClick={() => setSearchMode(m)}
                    >
                      {label}搜尋
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* 科目篩選指示條 */}
            {selectedSubject && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 text-xs text-blue-900 dark:text-blue-300 shrink-0">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    目前篩選科目：
                    <b>
                      {selectedSubject.parent_name ? `${selectedSubject.parent_name} > ` : ''}
                      {selectedSubject.name || selectedSubject.parent_name || selectedSubject.class}
                    </b>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSubject(null)}
                  className="text-2xs underline hover:text-blue-700"
                >
                  清除篩選（顯示全部）
                </button>
              </div>
            )}

            {/* 核心交易表格（Zero.Net 資料表格佈局） */}
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border shadow-xs">
              <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold border-b sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="w-8 px-2 py-2 text-center"></th>
                      <th className="px-3 py-2 whitespace-nowrap">日期 / 星期</th>
                      <th className="px-3 py-2 whitespace-nowrap">從項目</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">狀態</th>
                      <th className="px-3 py-2 whitespace-nowrap">至項目</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">金額 (NT$)</th>
                      <th className="px-3 py-2 whitespace-nowrap">摘要</th>
                      <th className="px-3 py-2 whitespace-nowrap">收付人</th>
                      <th className="px-3 py-2 whitespace-nowrap">備註 / 發票</th>
                      <th className="w-16 px-2 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          <span>正在讀取帳務記錄…</span>
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-muted-foreground">
                          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="font-medium text-sm">無符合條件的帳務分錄</p>
                          <p className="text-2xs text-muted-foreground mt-1">請切換年份月份、科目樹篩選或點擊「新增記錄」</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => {
                        const isIncome = r.type === 'income'
                        const isExpense = r.type === 'expense'
                        const isTransfer = r.type === 'transfer'

                        const fromItem = isIncome ? (r.category || '收入') : (acctName(r.account_id) || '現金/銀行')
                        const toItem = isExpense ? (r.category || '支出') : isTransfer ? (acctName(r.to_account_id) || '轉入帳戶') : (acctName(r.account_id) || '存入帳戶')

                        const typeLabel = isIncome ? '收入' : isExpense ? '支出' : '轉帳'
                        const typeColor = isIncome
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : isExpense
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'

                        const amtColor = isIncome ? 'text-emerald-600 font-bold' : isExpense ? 'text-red-600 font-bold' : 'text-blue-600 font-semibold'

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-muted/40 transition-colors group cursor-pointer"
                            onDoubleClick={() => { setEditingRecord(r); setShowFormModal(true) }}
                          >
                            {/* 圖示欄位 */}
                            <td className="px-2 py-2 text-center shrink-0">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-bold ${
                                isIncome ? 'bg-emerald-500 text-white' : isExpense ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                              }`}>
                                {isIncome ? '入' : isExpense ? '支' : '轉'}
                              </span>
                            </td>

                            {/* 日期 / 星期 */}
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-foreground">
                              {fmtDateWithDay(r.date)}
                            </td>

                            {/* 從項目 */}
                            <td className="px-3 py-2 font-medium whitespace-nowrap text-foreground/90">
                              {fromItem}
                            </td>

                            {/* 狀態 */}
                            <td className="px-2 py-2 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-2xs font-semibold ${typeColor}`}>
                                {typeLabel}
                              </span>
                            </td>

                            {/* 至項目 */}
                            <td className="px-3 py-2 font-medium whitespace-nowrap text-foreground/90">
                              {toItem}
                            </td>

                            {/* 金額 */}
                            <td className={`px-3 py-2 text-right font-mono tabular-nums text-sm ${amtColor}`}>
                              {fmt(r.amount)}
                            </td>

                            {/* 摘要 */}
                            <td className="px-3 py-2 truncate max-w-[220px]" title={r.description}>
                              {r.description || '—'}
                            </td>

                            {/* 收付人 */}
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {r.pay_coll_name || '—'}
                            </td>

                            {/* 備註 / 發票 */}
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">
                              {r.invoice_no ? <span className="font-mono text-foreground font-medium mr-1">[{r.invoice_no}]</span> : null}
                              {r.notes || '—'}
                            </td>

                            {/* 操作 */}
                            <td className="px-2 py-2 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-muted"
                                  onClick={e => { e.stopPropagation(); setEditingRecord(r); setShowFormModal(true) }}
                                  title="修改記錄"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-destructive"
                                  onClick={e => { e.stopPropagation(); handleDeleteRecord(r.id) }}
                                  title="刪除記錄"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 底部狀態列（Zero.Net 風格） */}
            <div className="border rounded-xl bg-card p-2.5 shadow-xs flex items-center justify-between text-xs flex-wrap gap-3 font-sans shrink-0">
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>帳本名稱: <b className="text-foreground">FT</b></span>
                <span>本日日期: <b className="text-foreground font-mono">{todayStr}</b></span>
                <span>顯示筆數: <b className="text-foreground font-mono">{filteredRecords.length}</b> 筆</span>
              </div>

              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span>本月收入: <b className="text-emerald-600 font-bold">{fmt(monthIncome)}</b></span>
                <span>本月支出: <b className="text-red-600 font-bold">{fmt(monthExpense)}</b></span>
                <span>收支餘額: <b className={`${monthBalance >= 0 ? 'text-blue-600' : 'text-orange-500'} font-bold`}>{fmt(monthBalance)}</b></span>
                <span className="text-muted-foreground">|</span>
                <span>本日收入: <b className="text-emerald-600">{fmt(todayIncome)}</b></span>
                <span>本日支出: <b className="text-red-600">{fmt(todayExpense)}</b></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 彈出視窗模組 */}
      {showFormModal && (
        <CashflowFormModal
          initial={editingRecord || {}}
          accounts={accounts}
          subjects={subjects}
          onSave={handleSaveRecord}
          onCancel={() => { setShowFormModal(false); setEditingRecord(null) }}
          saving={savingRecord}
        />
      )}

      {showSubjectSettings && (
        <SubjectManagementModal
          open={showSubjectSettings}
          onClose={() => setShowSubjectSettings(false)}
          subjects={subjects}
          onRefresh={() => { loadSubjects(); loadCashflow() }}
          accountBook="FT"
        />
      )}

      {showZeroImport && (
        <ZeroImportModal
          onClose={() => setShowZeroImport(false)}
          onDone={() => {
            loadSubjects()
            loadAccounts()
            loadCashflow()
            loadImportLogs()
          }}
        />
      )}

      <MdbErrorDrawer
        open={showErrorDrawer}
        onClose={() => setShowErrorDrawer(false)}
        errors={allErrors}
        bookName="FT"
        filename={latestLog?.filename}
      />

      {showExcelImport && (
        <ExcelImportModal
          title="批次匯入出納帳務"
          description="支援 .xlsx, .xls 與 .csv 檔案。請包含日期、類型（收入/支出）、金額等。"
          columns={CASHFLOW_IMPORT_COLUMNS}
          templateFilename="出納帳務範本"
          sheetName="收支紀錄"
          onClose={() => setShowExcelImport(false)}
          onSuccess={() => { loadCashflow(); loadAccounts() }}
          onSubmit={async rows => {
            const recordsToImport = rows.map(r => {
              const type = ['收入', 'income', '+'].includes(String(r.type ?? '').trim().toLowerCase()) ? 'income' : 'expense'
              const acct = accounts.find(a => a.name.trim().toLowerCase() === String(r.account_name ?? '').trim().toLowerCase())
              return {
                type,
                date: String(r.date ?? '').trim(),
                category: String(r.category ?? '').trim(),
                amount: Number(r.amount) || 0,
                description: String(r.description ?? '').trim(),
                pay_coll_name: String(r.pay_coll_name ?? '').trim(),
                account_id: acct?.id || null,
              }
            }).filter(r => r.amount > 0 && !!r.date)
            const res = await fetch('/api/hr/cashflow/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ records: recordsToImport }),
            })
            const d = await res.json()
            return { ok: res.ok, inserted: d.imported, skipped: d.skipped, error: d.error }
          }}
        />
      )}
    </div>
  )
}
