'use client'

import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, Building2,
  CreditCard, Zap, Wallet, TrendingUp, TrendingDown, ArrowUpCircle,
  ArrowDownCircle, ArrowLeftRight, Landmark, Banknote, PiggyBank,
  BarChart3, Upload, Store, FileText, Truck, FileSpreadsheet,
  Package, Search, AlertTriangle, Layers, Calendar, Filter,
  Settings, ChevronRight, ChevronDown, Sparkles, Database
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
import { MdbBatchManagementModal } from '@/components/finance/MdbBatchManagementModal'
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

function fmtDateWithDay(dateStr: string, locale: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  const day = d.toLocaleDateString(locale, { weekday: 'short' })
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
  onSave: (d: any, keepOpen?: boolean) => Promise<boolean>
  onCancel: () => void
  saving: boolean
}) {
  const t = useTranslations('FinancePage')
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
  const [addedCount, setAddedCount] = useState(0)
  const isNew = !initial.id

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || amount <= 0) {
      setErr(t('cf.errAmount'))
      return
    }
    if (!date) {
      setErr(t('cf.errDate'))
      return
    }
    if (type === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) {
      setErr(t('cf.errTransfer'))
      return
    }
    setErr('')
    const ok = await onSave({
      type, category, category_parent: categoryParent,
      amount, date, description, notes,
      pay_coll_name: payCollName, invoice_no: invoiceNo,
      account_id: accountId || null,
      to_account_id: type === 'transfer' ? (toAccountId || null) : null,
      receipt_url: initial.receipt_url ?? ''
    }, isNew)
    // 新增模式：保留日期、類型、科目與帳戶，清空金額與內容，方便連續輸入
    if (ok && isNew) {
      setAmount(0)
      setDescription('')
      setNotes('')
      setInvoiceNo('')
      setPayCollName('')
      setAddedCount(c => c + 1)
      document.getElementById('cashflow-amount-input')?.focus()
    } else if (!ok) {
      setErr(t('cf.errSave'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" onClick={onCancel}>
      <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-base">
            {initial.id ? t('cf.editTitle') : t('cf.newTitle')}
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
            <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.txType')}</label>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {(['expense', 'income', 'transfer'] as const).map(ft => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setType(ft)}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                    type === ft
                      ? ft === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : ft === 'expense'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-blue-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ft === 'income' ? t('cf.typeIncome') : ft === 'expense' ? t('cf.typeExpense') : t('cf.typeTransfer')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.dateReq')}</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.amountReq')}</label>
              <Input
                id="cashflow-amount-input"
                autoFocus
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
                <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.fromAccountReq')}</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (NT$ {fmt(a.balance ?? 0)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.toAccountReq')}</label>
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
                  {type === 'income' ? t('cf.receiveAccount') : t('cf.payAccount')}
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
                  {type === 'income' ? t('cf.incomeSubject') : t('cf.expenseSubject')}
                </label>
                <select
                  value={category}
                  onChange={handleCategorySelect}
                  className="w-full h-8 px-2 border rounded-md bg-background text-xs"
                >
                  <option value="">{t('cf.chooseSubject')}</option>
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
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.summary')}</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('cf.summaryPh')}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.payee')}</label>
              <Input
                value={payCollName}
                onChange={e => setPayCollName(e.target.value)}
                placeholder={t('cf.payeePh')}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.invoice')}</label>
              <Input
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder={t('cf.invoicePh')}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-2xs font-medium text-muted-foreground mb-1">{t('cf.notes')}</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('cf.notesPh')}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {isNew && addedCount > 0 && (
              <span className="mr-auto text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />{t('cf.addedCount', { n: addedCount })}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
              {isNew ? t('cf.closeExit') : t('cf.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs gap-1">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? t('cf.saving') : isNew ? t('cf.addEntry') : t('cf.confirmSave')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Main Finance Page ────────────────────────────────────────────
export default function FinancePage() {
  const t = useTranslations('FinancePage')
  const locale = useLocale()
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
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)

  // 錯誤與診斷日誌
  const [importLogs, setImportLogs] = useState<any[]>([])
  const [showErrorDrawer, setShowErrorDrawer] = useState(false)
  const [showZeroImport, setShowZeroImport] = useState(false)
  const [showMdbBatchModal, setShowMdbBatchModal] = useState(false)
  const [showExcelImport, setShowExcelImport] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
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
        setAccountsLoaded(true)
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
        setOpeningBalances(d.openingBalances ?? {})
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

    // 手動新增的帳目可能未帶 category_parent，依科目主檔補上父科目
    const parentOf = new Map<string, string>()
    for (const s of subjects) {
      if (s.class === 'income' || s.class === 'expense') parentOf.set(`${s.class}|${s.name}`, s.parent_name || '')
    }

    // 收支當月金額（來自當月 records）
    for (const r of records) {
      const amt = Number(r.amount) || 0
      if ((r.type === 'income' || r.type === 'expense') && r.category) {
        const parent = r.category_parent || parentOf.get(`${r.type}|${r.category}`) || ''
        const key = `${r.type}|${parent}|${r.category}`
        map[key] = (map[key] || 0) + amt
        map[r.category] = (map[r.category] || 0) + amt
      }
    }

    return map
  }, [accounts, records, subjects])

  // 每筆交易後的帳戶餘額：區間起日前結餘依日期、建立時間逐筆累加
  const runningBalances = useMemo(() => {
    const bal: Record<string, number> = { ...openingBalances }
    const out = new Map<string, { from?: number; to?: number }>()
    const sorted = [...records].sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1)
        : a.created_at !== b.created_at ? (a.created_at < b.created_at ? -1 : 1)
        : a.id < b.id ? -1 : 1)
    for (const r of sorted) {
      const amt = Number(r.amount) || 0
      const entry: { from?: number; to?: number } = {}
      if (r.account_id) {
        bal[r.account_id] = (bal[r.account_id] ?? 0) + (r.type === 'income' ? amt : -amt)
        entry.from = bal[r.account_id]
      }
      if (r.type === 'transfer' && r.to_account_id) {
        bal[r.to_account_id] = (bal[r.to_account_id] ?? 0) + amt
        entry.to = bal[r.to_account_id]
      }
      out.set(r.id, entry)
    }
    return out
  }, [records, openingBalances])

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
  // 最新批次若已撤回（含一鍵清空），不再顯示其錯誤
  const latestLog = importLogs[0]?.status === 'reverted' ? undefined : importLogs[0]
  const allErrors: MdbErrorInfo[] = latestLog?.errors || []
  const totalErrors = allErrors.length

  // 儲存記錄
  // keepOpen：新增模式儲存後不關閉視窗，可連續新增
  const handleSaveRecord = async (data: any, keepOpen?: boolean): Promise<boolean> => {
    setSavingRecord(true)
    try {
      const res = editingRecord
        ? await fetch('/api/hr/cashflow', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingRecord.id, ...data })
          })
        : await fetch('/api/hr/cashflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
      if (!res.ok) return false
      if (!keepOpen) {
        setShowFormModal(false)
        setEditingRecord(null)
      }
      loadCashflow()
      loadAccounts()
      return true
    } catch {
      return false
    } finally {
      setSavingRecord(false)
    }
  }

  // 刪除記錄
  const handleDeleteRecord = async (id: string) => {
    if (!confirm(t('cf.confirmDelete'))) return
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
          <p className="font-semibold">{t('cf.noAccess')}</p>
          <p className="text-sm text-gray-400">{t('cf.noAccessHint')}</p>
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
              <h1 className="text-xl font-bold">{t('cf.title')}</h1>
            </div>
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
            {t('cf.tabCashflow')}
          </button>
          <button
            onClick={() => setMainTab('pricing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mainTab === 'pricing' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('cf.tabPricing')}
          </button>
          <button
            onClick={() => setMainTab('pnl')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mainTab === 'pnl' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('cf.tabPnl')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/store-expenses">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Store className="h-3.5 w-3.5" />{t('cf.tabStoreExpenses')}
            </Button>
          </Link>
          <Link href="/vendors">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Truck className="h-3.5 w-3.5" />{t('cf.tabVendors')}
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
              accountsLoaded={accountsLoaded}
            />
          </div>

          {/* 右側：帳務小管家核心面板 - 獨立上下捲動 */}
          <div className="h-full min-h-0 min-w-0 flex flex-col space-y-2.5 overflow-hidden">
            {/* 上方子標籤（Zero.Net 子功能分頁） */}
            <div className="flex items-center gap-2 flex-wrap border-b pb-2 shrink-0">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs overflow-x-auto">
                <button
                  onClick={() => setSubTab('journal')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'journal' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('cf.subJournal')}
                </button>
                <button
                  onClick={() => setSubTab('today')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'today' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('cf.subToday')}
                </button>
                <button
                  onClick={() => setSubTab('month')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'month' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('cf.subMonth')}
                </button>
                <button
                  onClick={() => { setSubTab('regular'); setSelectedSubject({ parent_name: '定期存款' }) }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'regular' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('cf.subRegular')}
                </button>
                <button
                  onClick={() => setSubTab('project')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    subTab === 'project' ? 'bg-card text-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('cf.subProject')}
                </button>
              </div>

              {/* 新增記錄＋其他功能（下拉） */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 font-semibold"
                  onClick={() => { setEditingRecord(null); setShowFormModal(true) }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('cf.addRecord')}
                </Button>

                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 text-xs gap-1 ${totalErrors > 0 ? 'border-amber-300 text-amber-700' : ''}`}
                    onClick={() => setShowMoreMenu(v => !v)}
                  >
                    {totalErrors > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                    {t('cf.more')}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border bg-card shadow-lg p-1 text-xs">
                        <button
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left"
                          onClick={() => { setShowMoreMenu(false); setShowZeroImport(true) }}
                        >
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          {t('cf.importMdb')}
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left"
                          onClick={() => { setShowMoreMenu(false); setShowMdbBatchModal(true) }}
                        >
                          <Database className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          {t('cf.mdbBatches')}
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left"
                          onClick={() => { setShowMoreMenu(false); setShowExcelImport(true) }}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          {t('cf.batchImport')}
                        </button>
                        {totalErrors > 0 && (
                          <button
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left text-amber-700"
                            onClick={() => { setShowMoreMenu(false); setShowErrorDrawer(true) }}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            {t('cf.importErrors', { n: totalErrors })}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 搜尋列（Zero.Net 風格：輸入框 + 多維度按鈕） */}
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border shrink-0">
              <span className="text-xs font-medium text-muted-foreground shrink-0">{t('cf.searchLabel')}</span>
              <div className="relative flex-1 min-w-[150px]">
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('cf.searchPh')}
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
                  const label = t(`cf.searchMode.${m}`)
                  return (
                    <Button
                      key={m}
                      size="sm"
                      variant={searchMode === m ? 'default' : 'ghost'}
                      className="h-7 text-2xs px-2"
                      onClick={() => setSearchMode(m)}
                    >
                      {label}
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
                    {t('cf.filteringBy')}
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
                  {t('cf.clearFilter')}
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
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colDate')}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colFrom')}</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">{t('cf.colStatus')}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colTo')}</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">{t('cf.colAmount')}</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">{t('cf.colBalance')}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colSummary')}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colPayee')}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t('cf.colNotes')}</th>
                      <th className="w-16 px-2 py-2 text-center">{t('cf.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="py-16 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          <span>{t('cf.loading')}</span>
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-16 text-center text-muted-foreground">
                          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="font-medium text-sm">{t('cf.empty')}</p>
                          <p className="text-2xs text-muted-foreground mt-1">{t('cf.emptyHint')}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => {
                        const isIncome = r.type === 'income'
                        const isExpense = r.type === 'expense'
                        const isTransfer = r.type === 'transfer'

                        const fromItem = isIncome ? (r.category || t('cf.income')) : (acctName(r.account_id) || t('cf.cashBank'))
                        const toItem = isExpense ? (r.category || t('cf.expense')) : isTransfer ? (acctName(r.to_account_id) || t('cf.toAccount')) : (acctName(r.account_id) || t('cf.depositAccount'))

                        const typeLabel = isIncome ? t('cf.income') : isExpense ? t('cf.expense') : t('cf.transfer')
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
                                {isIncome ? t('cf.badgeIn') : isExpense ? t('cf.badgeOut') : t('cf.badgeTransfer')}
                              </span>
                            </td>

                            {/* 日期 / 星期 */}
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-foreground">
                              {fmtDateWithDay(r.date, locale)}
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

                            {/* 餘額：選取的帳戶為轉入方時顯示轉入帳戶餘額，否則顯示本筆帳戶餘額 */}
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-sm text-foreground/80 whitespace-nowrap">
                              {(() => {
                                const rb = runningBalances.get(r.id)
                                const showTo = isTransfer && !!selectedSubject?.name && acctName(r.to_account_id) === selectedSubject.name
                                const v = showTo ? rb?.to : rb?.from
                                return v === undefined ? '—' : fmt(v)
                              })()}
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
                                  title={t('cf.editRecord')}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-destructive"
                                  onClick={e => { e.stopPropagation(); handleDeleteRecord(r.id) }}
                                  title={t('cf.deleteRecord')}
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
                <span>{t('cf.ledgerName')} <b className="text-foreground">FT</b></span>
                <span>{t('cf.todayDate')} <b className="text-foreground font-mono">{todayStr}</b></span>
                <span>{t('cf.shown')} <b className="text-foreground font-mono">{filteredRecords.length}</b> {t('cf.rowsUnit')}</span>
              </div>

              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span>{t('cf.monthIncome')} <b className="text-emerald-600 font-bold">{fmt(monthIncome)}</b></span>
                <span>{t('cf.monthExpense')} <b className="text-red-600 font-bold">{fmt(monthExpense)}</b></span>
                <span>{t('cf.monthNet')} <b className={`${monthBalance >= 0 ? 'text-blue-600' : 'text-orange-500'} font-bold`}>{fmt(monthBalance)}</b></span>
                <span className="text-muted-foreground">|</span>
                <span>{t('cf.todayIncome')} <b className="text-emerald-600">{fmt(todayIncome)}</b></span>
                <span>{t('cf.todayExpense')} <b className="text-red-600">{fmt(todayExpense)}</b></span>
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

      <MdbBatchManagementModal
        open={showMdbBatchModal}
        onClose={() => setShowMdbBatchModal(false)}
        accountBook="FT"
        onReverted={() => {
          loadSubjects()
          loadAccounts()
          loadCashflow()
          loadImportLogs()
        }}
      />

      {showExcelImport && (
        <ExcelImportModal
          title={t('cf.importTitle')}
          description={t('cf.importDesc')}
          columns={CASHFLOW_IMPORT_COLUMNS}
          columnsNs="FinancePageImport"
          templateFilename={t('cf.importTemplate')}
          sheetName={t('cf.importSheet')}
          onClose={() => setShowExcelImport(false)}
          onSuccess={() => { loadCashflow(); loadAccounts() }}
          onSubmit={async rows => {
            const recordsToImport = rows.map(r => {
              const type = ['收入', 'income', '+', 'thu'].includes(String(r.type ?? '').trim().toLowerCase()) ? 'income' : 'expense'
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
