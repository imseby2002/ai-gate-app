'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, Building2, CreditCard, Zap, Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Landmark, Banknote, PiggyBank, BarChart3, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ─── Types ───────────────────────────────────────────────────────
type Tab = 'cashflow' | 'accounts' | 'reports' | 'import'
type FlowType = 'income' | 'expense' | 'transfer'

interface Cashflow {
  id: string
  type: FlowType
  category: string
  amount: number
  date: string
  description: string
  notes: string
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

// ─── Constants ───────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  'income': '收入', 'expense': '支出', 'transfer': '轉帳',
  'cash': '現金', 'bank': '銀行', 'credit': '信用卡', 'ewallet': '電子錢包', 'other': '其他',
}

const INCOME_CATEGORIES = ['銷售收入', '服務費', '租金收入', '利息收入', '其他收入']
const EXPENSE_CATEGORIES = ['薪資支出', '辦公費', '差旅費', '廣告費', '水電費', '租金支出', '採購費', '其他支出']
const ACCOUNT_KINDS: Account['kind'][] = ['cash', 'bank', 'credit', 'ewallet', 'other']

function AccountIcon({ kind, className }: { kind: Account['kind']; className?: string }) {
  const Cmp = kind === 'bank' ? Landmark : kind === 'credit' ? CreditCard
    : kind === 'ewallet' ? Wallet : kind === 'other' ? PiggyBank : Banknote
  return <Cmp className={className} />
}

const fmt = (n: number) => n.toLocaleString('zh-TW')
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('zh-TW') : '—'

// ─── Helpers ─────────────────────────────────────────────────────
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

function SelectEl({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none disabled:opacity-50">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Cashflow Form ────────────────────────────────────────────────
function CashflowForm({ initial, accounts, onSave, onCancel, saving }: {
  initial: Omit<Cashflow, 'id' | 'created_at'>
  accounts: Account[]
  onSave: (d: Omit<Cashflow, 'id' | 'created_at'>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [d, setD] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof typeof d, v: string | number | null) => setD(prev => ({ ...prev, [k]: v }))
  const cats = d.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const isTransfer = d.type === 'transfer'
  const acctOpts = [{ value: '', label: '— 未指定 —' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]

  const uploadReceipt = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/hr/receipts', { method: 'POST', body: fd })
      const j = await res.json()
      if (j.url) set('receipt_url', j.url)
    } finally { setUploading(false) }
  }

  const transferInvalid = isTransfer && (!d.account_id || !d.to_account_id || d.account_id === d.to_account_id)

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <Field label="類型 *">
          <SelectEl value={d.type} onChange={v => set('type', v)}
            options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }, { value: 'transfer', label: '轉帳' }]}
            disabled={saving} />
        </Field>
        {!isTransfer ? (
          <Field label="分類">
            <div className="flex gap-1">
              <SelectEl value={cats.includes(d.category) ? d.category : '__custom__'}
                onChange={v => set('category', v === '__custom__' ? '' : v)}
                options={[...cats.map(c => ({ value: c, label: c })), { value: '__custom__', label: '自訂...' }]}
                disabled={saving} />
              {!cats.includes(d.category) && (
                <InputEl value={d.category} onChange={v => set('category', v)} placeholder="自訂分類" disabled={saving} />
              )}
            </div>
          </Field>
        ) : <div />}
        <Field label={isTransfer ? '轉出帳戶 *' : '帳戶'}>
          <SelectEl value={d.account_id ?? ''} onChange={v => set('account_id', v || null)} options={acctOpts} disabled={saving} />
        </Field>
        {isTransfer && (
          <Field label="轉入帳戶 *">
            <SelectEl value={d.to_account_id ?? ''} onChange={v => set('to_account_id', v || null)} options={acctOpts} disabled={saving} />
          </Field>
        )}
        <Field label="金額（元）*">
          <InputEl value={d.amount} onChange={v => set('amount', Number(v) || 0)} type="number" placeholder="0" disabled={saving} />
        </Field>
        <Field label="日期 *">
          <InputEl value={d.date} onChange={v => set('date', v)} type="date" disabled={saving} />
        </Field>
        <Field label="摘要" >
          <InputEl value={d.description} onChange={v => set('description', v)} placeholder="說明用途" disabled={saving} />
        </Field>
        <Field label="備註">
          <InputEl value={d.notes} onChange={v => set('notes', v)} placeholder="其他補充" disabled={saving} />
        </Field>
      </div>

      {/* 收據附件 */}
      <Field label="收據／發票">
        {d.receipt_url ? (
          <div className="flex items-center gap-2">
            <a href={d.receipt_url} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={d.receipt_url} alt="收據" className="h-14 w-14 rounded-md border object-cover" />
            </a>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500" onClick={() => set('receipt_url', '')} disabled={saving}>
              <X className="h-3.5 w-3.5" />移除
            </Button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 h-8 px-3 rounded-md border bg-background text-sm cursor-pointer hover:bg-gray-100 w-fit">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            上傳圖片
            <input type="file" accept="image/*" className="hidden" disabled={saving || uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(f) }} />
          </label>
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={!d.amount || !d.date || saving || uploading || transferInvalid}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          儲存
        </Button>
      </div>
    </div>
  )
}

// ─── Cashflow Tab ─────────────────────────────────────────────────
function CashflowTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all')
  const [records, setRecords] = useState<Cashflow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Cashflow | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const acctName = useCallback((id: string | null) => accounts.find(a => a.id === id)?.name ?? '', [accounts])

  const BLANK: Omit<Cashflow, 'id' | 'created_at'> = {
    type: 'expense', category: '', amount: 0,
    date: `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    description: '', notes: '', account_id: null, to_account_id: null, receipt_url: '',
  }

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/hr/accounts')
    const d = await res.json()
    setAccounts(d.accounts ?? [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(year), month: String(month) })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    const res = await fetch(`/api/hr/cashflow?${params}`)
    const d = await res.json()
    setRecords(d.cashflow ?? [])
    setLoading(false)
  }, [year, month, typeFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadAccounts() }, [loadAccounts])

  const save = async (data: Omit<Cashflow, 'id' | 'created_at'>) => {
    setSaving(true); setErr('')
    try {
      if (editing) {
        await fetch('/api/hr/cashflow', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) })
      } else {
        await fetch('/api/hr/cashflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      }
      setShowForm(false); setEditing(null); load(); loadAccounts()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除此筆記錄？')) return
    await fetch('/api/hr/cashflow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load(); loadAccounts()
  }

  const totalIncome  = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const net = totalIncome - totalExpense

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
          <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 px-1">‹</button>
          <span className="text-sm font-medium w-12 text-center">{year}年</span>
          <button onClick={() => setYear(y => y + 1)} className="text-gray-400 hover:text-gray-700 px-1">›</button>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${month === m ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'income', 'expense', 'transfer'] as const).map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'ghost'} onClick={() => setTypeFilter(t)}>
              {t === 'all' ? '全部' : t === 'income' ? '收入' : t === 'expense' ? '支出' : '轉帳'}
            </Button>
          ))}
        </div>
        <Button size="sm" className="ml-auto gap-1" onClick={() => { setShowForm(true); setEditing(null) }}>
          <Plus className="h-4 w-4" />新增記錄
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500">本月收入</span>
          </div>
          <p className="text-xl font-bold text-green-600">NT$ {fmt(totalIncome)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-500">本月支出</span>
          </div>
          <p className="text-xl font-bold text-red-500">NT$ {fmt(totalExpense)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            {net >= 0 ? <TrendingUp className="h-4 w-4 text-blue-500" /> : <TrendingDown className="h-4 w-4 text-orange-500" />}
            <span className="text-xs text-gray-500">淨收支</span>
          </div>
          <p className={`text-xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
            {net >= 0 ? '+' : ''}NT$ {fmt(net)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-gray-500">帳戶總資產</span>
          </div>
          <p className="text-xl font-bold text-gray-800">NT$ {fmt(accounts.reduce((s, a) => s + (a.balance ?? 0), 0))}</p>
        </Card>
      </div>

      {showForm && !editing && (
        <CashflowForm initial={{ ...BLANK }} accounts={accounts} onSave={save} onCancel={() => setShowForm(false)} saving={saving} />
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{year}年{month}月尚無出納記錄</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const border = r.type === 'income' ? 'border-l-green-400' : r.type === 'expense' ? 'border-l-red-400' : 'border-l-blue-400'
            const amtColor = r.type === 'income' ? 'text-green-600' : r.type === 'expense' ? 'text-red-500' : 'text-blue-600'
            const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '-' : ''
            return (
            <Card key={r.id} className={`p-3 border-l-4 ${border}`}>
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {r.type === 'income' ? <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    : r.type === 'expense' ? <ArrowDownCircle className="h-5 w-5 text-red-400" />
                    : <ArrowLeftRight className="h-5 w-5 text-blue-500" />}
                </div>
                {r.receipt_url && (
                  <a href={r.receipt_url} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={r.receipt_url} alt="收據" className="h-9 w-9 rounded border object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{r.description || r.category || (r.type === 'transfer' ? '轉帳' : '—')}</span>
                    {r.type !== 'transfer' && r.category && <Badge variant="secondary">{r.category}</Badge>}
                    <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    {r.type === 'transfer' ? (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" />{acctName(r.account_id) || '未指定'}
                        <ArrowLeftRight className="h-3 w-3" />{acctName(r.to_account_id) || '未指定'}
                      </span>
                    ) : r.account_id ? (
                      <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />{acctName(r.account_id)}</span>
                    ) : null}
                    {r.notes && <span>· {r.notes}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold tabular-nums ${amtColor}`}>
                    {sign}NT$ {fmt(r.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(r); setShowForm(false) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {editing?.id === r.id && (
                <div className="mt-3">
                  <CashflowForm accounts={accounts}
                    initial={{ type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description, notes: r.notes, account_id: r.account_id, to_account_id: r.to_account_id, receipt_url: r.receipt_url }}
                    onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                </div>
              )}
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Account Form ─────────────────────────────────────────────────
function AccountForm({ initial, onSave, onCancel, saving }: {
  initial: Pick<Account, 'name' | 'kind' | 'opening_balance' | 'currency' | 'note'>
  onSave: (d: Pick<Account, 'name' | 'kind' | 'opening_balance' | 'currency' | 'note'>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [d, setD] = useState(initial)
  const set = (k: keyof typeof d, v: string | number) => setD(prev => ({ ...prev, [k]: v }))
  return (
    <div className="space-y-3 p-4 rounded-xl border bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <Field label="帳戶名稱 *"><InputEl value={d.name} onChange={v => set('name', v)} placeholder="例：台新銀行、零用金" disabled={saving} /></Field>
        <Field label="類型">
          <SelectEl value={d.kind} onChange={v => set('kind', v)}
            options={ACCOUNT_KINDS.map(k => ({ value: k, label: LABELS[k] ?? k }))} disabled={saving} />
        </Field>
        <Field label="期初餘額（元）"><InputEl value={d.opening_balance} onChange={v => set('opening_balance', Number(v) || 0)} type="number" disabled={saving} /></Field>
        <Field label="幣別"><InputEl value={d.currency} onChange={v => set('currency', v)} placeholder="TWD" disabled={saving} /></Field>
        <div className="col-span-2"><Field label="備註"><InputEl value={d.note} onChange={v => set('note', v)} placeholder="其他補充" disabled={saving} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>取消</Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={!d.name || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}儲存
        </Button>
      </div>
    </div>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────────
function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const BLANK = { name: '', kind: 'cash' as Account['kind'], opening_balance: 0, currency: 'TWD', note: '' }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/accounts')
    const d = await res.json()
    setAccounts(d.accounts ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (data: typeof BLANK) => {
    setSaving(true); setErr('')
    try {
      if (editing) {
        await fetch('/api/hr/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...data }) })
      } else {
        await fetch('/api/hr/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      }
      setShowForm(false); setEditing(null); load()
    } catch { setErr('儲存失敗') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除此帳戶？')) return
    const res = await fetch('/api/hr/accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { const j = await res.json(); alert(j.error || '刪除失敗'); return }
    load()
  }

  const total = accounts.reduce((s, a) => s + (a.balance ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Card className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-gray-500">總資產（所有帳戶結餘）</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">NT$ {fmt(total)}</p>
        </Card>
        <Button size="sm" className="gap-1" onClick={() => { setShowForm(true); setEditing(null) }}>
          <Plus className="h-4 w-4" />新增帳戶
        </Button>
      </div>

      {showForm && !editing && <AccountForm initial={{ ...BLANK }} onSave={save} onCancel={() => setShowForm(false)} saving={saving} />}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">尚無帳戶，先新增一個帳戶吧</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {accounts.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <AccountIcon kind={a.kind} className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <Badge variant="secondary">{LABELS[a.kind] ?? a.kind}</Badge>
                  </div>
                  <p className="text-xl font-bold tabular-nums mt-1">{a.currency} {fmt(a.balance ?? 0)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">期初 {fmt(a.opening_balance)}{a.note ? ` · ${a.note}` : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(a); setShowForm(false) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => remove(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {editing?.id === a.id && (
                <div className="mt-3">
                  <AccountForm initial={{ name: a.name, kind: a.kind, opening_balance: a.opening_balance, currency: a.currency, note: a.note }}
                    onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────
function ReportsTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [records, setRecords] = useState<Cashflow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch(`/api/hr/cashflow?year=${year}`).then(r => r.json()),
      fetch('/api/hr/accounts').then(r => r.json()),
    ])
    setRecords(r1.cashflow ?? [])
    setAccounts(r2.accounts ?? [])
    setLoading(false)
  }, [year])
  useEffect(() => { load() }, [load])

  const income = records.filter(r => r.type === 'income')
  const expense = records.filter(r => r.type === 'expense')
  const totalIncome = income.reduce((s, r) => s + r.amount, 0)
  const totalExpense = expense.reduce((s, r) => s + r.amount, 0)
  const net = totalIncome - totalExpense

  // 支出分類佔比
  const byCat = new Map<string, number>()
  for (const r of expense) { const k = r.category || '未分類'; byCat.set(k, (byCat.get(k) ?? 0) + r.amount) }
  const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  const catMax = catRows.length ? catRows[0][1] : 1

  // 月趨勢
  const months = Array.from({ length: 12 }, (_, i) => {
    const inc = income.filter(r => new Date(r.date).getMonth() === i).reduce((s, r) => s + r.amount, 0)
    const exp = expense.filter(r => new Date(r.date).getMonth() === i).reduce((s, r) => s + r.amount, 0)
    return { m: i + 1, inc, exp }
  })
  const monthMax = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border rounded-lg px-2 py-1 w-fit">
        <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 px-1">‹</button>
        <span className="text-sm font-medium w-12 text-center">{year}年</span>
        <button onClick={() => setYear(y => y + 1)} className="text-gray-400 hover:text-gray-700 px-1">›</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><span className="text-xs text-gray-500">年度收入</span><p className="text-xl font-bold text-green-600 mt-1">NT$ {fmt(totalIncome)}</p></Card>
            <Card className="p-4"><span className="text-xs text-gray-500">年度支出</span><p className="text-xl font-bold text-red-500 mt-1">NT$ {fmt(totalExpense)}</p></Card>
            <Card className="p-4"><span className="text-xs text-gray-500">年度淨額</span><p className={`text-xl font-bold mt-1 ${net >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{net >= 0 ? '+' : ''}NT$ {fmt(net)}</p></Card>
            <Card className="p-4"><span className="text-xs text-gray-500">總資產</span><p className="text-xl font-bold text-gray-800 mt-1">NT$ {fmt(accounts.reduce((s, a) => s + (a.balance ?? 0), 0))}</p></Card>
          </div>

          {/* 月趨勢 */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">月收支趨勢</span></div>
            <div className="flex items-end gap-1.5 h-40">
              {months.map(m => (
                <div key={m.m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                    <div className="w-1/2 bg-green-400 rounded-t" style={{ height: `${(m.inc / monthMax) * 100}%` }} title={`收入 ${fmt(m.inc)}`} />
                    <div className="w-1/2 bg-red-400 rounded-t" style={{ height: `${(m.exp / monthMax) * 100}%` }} title={`支出 ${fmt(m.exp)}`} />
                  </div>
                  <span className="text-[10px] text-gray-400">{m.m}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />收入</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />支出</span>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-3">
            {/* 支出分類佔比 */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-red-500" /><span className="text-sm font-semibold">支出分類佔比</span></div>
              {catRows.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">無支出記錄</p> : (
                <div className="space-y-2">
                  {catRows.map(([cat, amt]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{cat}</span>
                        <span className="tabular-nums text-gray-500">{fmt(amt)}（{totalExpense ? Math.round(amt / totalExpense * 100) : 0}%）</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(amt / catMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 帳戶餘額表 */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">各帳戶結餘</span></div>
              {accounts.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">無帳戶</p> : (
                <div className="space-y-2">
                  {accounts.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <AccountIcon kind={a.kind} className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="tabular-nums font-medium">{a.currency} {fmt(a.balance ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ─── CSV 工具 ─────────────────────────────────────────────────────
function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQ = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === delim) { row.push(field); field = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

const pad2 = (s: string) => s.padStart(2, '0')
function normDate(s: string): string {
  s = (s || '').trim().split(' ')[0].split('T')[0]
  if (!s) return ''
  let m
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}` // dd/mm/yyyy
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/))) return `20${m[3]}-${pad2(m[2])}-${pad2(m[1])}`
  return ''
}
function normAmount(s: string): number {
  const str = String(s ?? '')
  const neg = str.includes('-')
  const digits = str.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return neg ? -n : n
}

// ─── Import Tab ───────────────────────────────────────────────────
function ImportTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [err, setErr] = useState('')

  // 對應設定
  const [dateCol, setDateCol] = useState(-1)
  const [amountCol, setAmountCol] = useState(-1)
  const [typeMode, setTypeMode] = useState<'fixed' | 'column'>('fixed')
  const [fixedType, setFixedType] = useState<'income' | 'expense'>('income')
  const [typeCol, setTypeCol] = useState(-1)
  const [catMode, setCatMode] = useState<'none' | 'fixed' | 'column'>('none')
  const [fixedCat, setFixedCat] = useState('')
  const [catCol, setCatCol] = useState(-1)
  const [descCol, setDescCol] = useState(-1)
  const [accountId, setAccountId] = useState('')

  useEffect(() => {
    fetch('/api/hr/accounts').then(r => r.json()).then(d => setAccounts(d.accounts ?? []))
  }, [])

  const onFile = async (file: File) => {
    setErr(''); setResult(null)
    const text = await file.text()
    const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] || ''
    const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','
    const all = parseCSV(text, delim)
    if (all.length < 2) { setErr('檔案沒有資料列'); return }
    setFileName(file.name)
    setHeaders(all[0])
    setDataRows(all.slice(1))
    // 自動猜測欄位
    const find = (kw: RegExp) => all[0].findIndex(h => kw.test(h))
    setDateCol(find(/date|ngày|日期|時間|time/i))
    setAmountCol(find(/amount|total|tổng|tiền|金額|thành tiền|doanh thu/i))
    setDescCol(find(/desc|note|ghi chú|nội dung|摘要|tên|name/i))
  }

  const colOpts = (allowNone: boolean) => [
    ...(allowNone ? [{ value: '-1', label: '— 不使用 —' }] : []),
    ...headers.map((h, i) => ({ value: String(i), label: h || `欄位${i + 1}` })),
  ]

  const isIncome = (v: string) => /收|income|thu|\+|bán|doanh thu/i.test(v) && !/支|expense|chi/i.test(v)

  const mapped = dataRows.map(r => {
    const date = normDate(r[dateCol] ?? '')
    const amount = normAmount(r[amountCol] ?? '')
    let type: 'income' | 'expense' = fixedType
    if (typeMode === 'column' && typeCol >= 0) type = isIncome(r[typeCol] ?? '') ? 'income' : 'expense'
    const category = catMode === 'fixed' ? fixedCat : catMode === 'column' && catCol >= 0 ? (r[catCol] ?? '') : ''
    const description = descCol >= 0 ? (r[descCol] ?? '') : ''
    return { type, category, amount, date, description, account_id: accountId || null, valid: !!date && amount !== 0 }
  })
  const validRows = mapped.filter(m => m.valid)

  const doImport = async () => {
    setImporting(true); setErr(''); setResult(null)
    try {
      const res = await fetch('/api/hr/cashflow/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: validRows.map(m => ({ type: m.type, category: m.category, amount: m.amount, date: m.date, description: m.description, account_id: m.account_id })) }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || '匯入失敗'); return }
      setResult({ imported: j.imported, skipped: j.skipped })
      setHeaders([]); setDataRows([]); setFileName('')
    } catch { setErr('匯入失敗') } finally { setImporting(false) }
  }

  const reset = () => { setHeaders([]); setDataRows([]); setFileName(''); setResult(null); setErr('') }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-blue-50/50 p-4 text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-800">從 iPOS 報表匯入</p>
        <p>在 iPOS（POS／進銷存）匯出報表，存成 <b>CSV</b>（Excel 檔請「另存新檔 → CSV」），上傳後對應欄位即可批次寫入出納帳務。</p>
        <p className="text-xs text-gray-400">支援逗號或分號分隔；日期支援 yyyy-mm-dd 與 dd/mm/yyyy；金額自動去除貨幣符號與千分位。</p>
      </div>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-700">✓ 匯入完成：成功 {result.imported} 筆{result.skipped > 0 ? `，略過 ${result.skipped} 筆（缺日期或金額）` : ''}</p>
        </div>
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}

      {headers.length === 0 ? (
        <label className="flex flex-col items-center justify-center gap-2 py-12 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 text-gray-400">
          <Upload className="h-8 w-8" />
          <span className="text-sm">點此選擇 CSV 檔案</span>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{fileName}</Badge>
            <span className="text-gray-400">共 {dataRows.length} 列</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>重新選檔</Button>
          </div>

          {/* 欄位對應 */}
          <div className="grid md:grid-cols-2 gap-3 p-4 rounded-xl border bg-gray-50">
            <Field label="日期欄位 *">
              <SelectEl value={String(dateCol)} onChange={v => setDateCol(Number(v))} options={colOpts(true)} />
            </Field>
            <Field label="金額欄位 *">
              <SelectEl value={String(amountCol)} onChange={v => setAmountCol(Number(v))} options={colOpts(true)} />
            </Field>
            <Field label="類型">
              <div className="flex gap-1">
                <SelectEl value={typeMode} onChange={v => setTypeMode(v as 'fixed' | 'column')}
                  options={[{ value: 'fixed', label: '固定' }, { value: 'column', label: '依欄位' }]} />
                {typeMode === 'fixed'
                  ? <SelectEl value={fixedType} onChange={v => setFixedType(v as 'income' | 'expense')} options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }]} />
                  : <SelectEl value={String(typeCol)} onChange={v => setTypeCol(Number(v))} options={colOpts(true)} />}
              </div>
            </Field>
            <Field label="記入帳戶">
              <SelectEl value={accountId} onChange={setAccountId}
                options={[{ value: '', label: '— 不指定 —' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
            </Field>
            <Field label="分類">
              <div className="flex gap-1">
                <SelectEl value={catMode} onChange={v => setCatMode(v as 'none' | 'fixed' | 'column')}
                  options={[{ value: 'none', label: '無' }, { value: 'fixed', label: '固定' }, { value: 'column', label: '依欄位' }]} />
                {catMode === 'fixed' && <InputEl value={fixedCat} onChange={setFixedCat} placeholder="例：POS營收" />}
                {catMode === 'column' && <SelectEl value={String(catCol)} onChange={v => setCatCol(Number(v))} options={colOpts(true)} />}
              </div>
            </Field>
            <Field label="摘要欄位">
              <SelectEl value={String(descCol)} onChange={v => setDescCol(Number(v))} options={colOpts(true)} />
            </Field>
          </div>

          {/* 預覽 */}
          <div className="space-y-2">
            <p className="text-sm text-gray-500">預覽（有效 <b className="text-gray-800">{validRows.length}</b> / {dataRows.length} 列）</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">日期</th>
                    <th className="px-2 py-1.5 text-left">類型</th>
                    <th className="px-2 py-1.5 text-right">金額</th>
                    <th className="px-2 py-1.5 text-left">分類</th>
                    <th className="px-2 py-1.5 text-left">摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((m, i) => (
                    <tr key={i} className={`border-t ${m.valid ? '' : 'bg-red-50 text-red-400'}`}>
                      <td className="px-2 py-1.5">{m.date || '✕ 無效'}</td>
                      <td className="px-2 py-1.5">{m.type === 'income' ? '收入' : '支出'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(m.amount)}</td>
                      <td className="px-2 py-1.5">{m.category || '—'}</td>
                      <td className="px-2 py-1.5 truncate max-w-[200px]">{m.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataRows.length > 10 && <p className="text-xs text-gray-400">（僅顯示前 10 列）</p>}
          </div>

          <div className="flex justify-end">
            <Button onClick={doImport} disabled={importing || dateCol < 0 || amountCol < 0 || validRows.length === 0} className="gap-1.5">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              匯入 {validRows.length} 筆
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('cashflow')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/hr/accounts').then(res => setIsAdmin(res.status !== 403))
  }, [])

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'cashflow',  label: '出納帳務', icon: <Wallet className="h-4 w-4" /> },
    { id: 'accounts',  label: '帳戶管理', icon: <Landmark className="h-4 w-4" /> },
    { id: 'reports',   label: '財務報表', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'import',    label: '資料匯入', icon: <Upload className="h-4 w-4" /> },
  ]

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
          <p className="font-semibold">僅管理者可使用出納總務功能</p>
          <p className="text-sm text-gray-400">請以管理者帳號登入後再試</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">出納總務</h1>
          <p className="text-sm text-gray-500">出納帳務、帳戶管理、財務報表</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/hr">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Building2 className="h-4 w-4" />人事管理
            </Button>
          </Link>
          <Link href="/resume">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Zap className="h-4 w-4" />職場工具
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card className="p-5">
        {tab === 'cashflow'  && <CashflowTab />}
        {tab === 'accounts'  && <AccountsTab />}
        {tab === 'reports'   && <ReportsTab />}
        {tab === 'import'    && <ImportTab />}
      </Card>
    </div>
  )
}
