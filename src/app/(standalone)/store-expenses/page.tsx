'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Plus, Trash2, X, Store, Tags, Wallet, Table2, BarChart3, Upload, Truck, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
type Tab = 'stores' | 'categories' | 'bills' | 'vendors' | 'report'
interface StoreRow { id: string; code: string; name: string; region: string; active: boolean }
interface CatRow { id: string; code: string; name: string; entry_method: string; vendor_service: string; sort: number }

const METHOD_LABEL: Record<string, string> = { import: '人工匯入', vendor: '廠商填', manual: '手動' }
const SERVICE_LABEL: Record<string, string> = { gas: '瓦斯', ice: '冰塊', '': '—' }

const STORE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'code', label: '門市編碼', required: true, example: 'YL', aliases: ['code', '編碼', '門市代碼'] },
  { key: 'name', label: '門市名稱', required: true, example: '怡朗店', aliases: ['name', '名稱', '門市名稱'] },
  { key: 'region', label: '區域', example: '胡志明', aliases: ['region', '區域'] },
  { key: 'active', label: '啟用狀態', example: '是', aliases: ['active', '啟用', '狀態'] },
]

const CATEGORY_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'code', label: '科目編碼', required: true, example: 'WATER', aliases: ['code', '科目編碼', '代碼'] },
  { key: 'name', label: '科目名稱', required: true, example: '水費', aliases: ['name', '科目名稱', '名稱'] },
  { key: 'entry_method', label: '填寫方式', example: '人工匯入', aliases: ['entry_method', '填寫方式', '方式'] },
  { key: 'vendor_service', label: '廠商別', example: '', aliases: ['vendor_service', '廠商別', '廠商服務'] },
  { key: 'sort', label: '排序', example: 1, aliases: ['sort', '排序'] },
]

const VENDOR_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '廠商名稱', required: true, example: '台灣瓦斯', aliases: ['name', '廠商名稱', '廠商'] },
  { key: 'service', label: '服務別', example: '瓦斯', aliases: ['service', '服務別', '服務項目'] },
  { key: 'regions', label: '涵蓋區域', example: '胡志明,河內', aliases: ['regions', '區域', '涵蓋區域'] },
  { key: 'active', label: '啟用狀態', example: '是', aliases: ['active', '啟用', '狀態'] },
]

export default function StoreExpensesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('stores')

  const check = useCallback(async () => {
    const res = await fetch('/api/fin/stores')
    setIsAdmin(res.status !== 403)
  }, [])
  useEffect(() => { check() }, [check])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅出納總務單位可使用門市費用</p></div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'stores', label: '門市／區域', icon: <Store className="h-4 w-4" /> },
    { id: 'categories', label: '費用科目', icon: <Tags className="h-4 w-4" /> },
    { id: 'bills', label: '月度費用', icon: <Table2 className="h-4 w-4" /> },
    { id: 'vendors', label: '廠商填報', icon: <Truck className="h-4 w-4" /> },
    { id: 'report', label: '收支報表', icon: <BarChart3 className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市費用</h1>
          <p className="text-sm text-gray-500">門市/區域、費用科目（水電瓦斯冰塊）</p>
        </div>
        <div className="ml-auto"><Link href="/finance"><Button variant="outline" size="sm" className="gap-1.5"><Wallet className="h-4 w-4" />出納總務</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'stores' && <StoresTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'bills' && <BillsTab />}
      {tab === 'vendors' && <VendorsTab />}
      {tab === 'report' && <ReportTab />}
    </div>
  )
}

// ── 廠商填報 ──
interface Vendor { id: string; name: string; service: string; regions: string[]; fill_token: string; active: boolean }

function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Vendor> | null>(null)
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/fin/vendors').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive) return
      if (d) { setVendors(d.vendors ?? []); setRegions(d.regions ?? []) }
      setLoading(false)
    })
    return () => { alive = false }
  }, [tick])
  const reload = () => setTick(t => t + 1)

  const save = async () => {
    if (!editing?.name?.trim()) return
    setBusy(true)
    const res = await fetch('/api/fin/vendors', {
      method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); reload() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (v: Vendor) => {
    if (!confirm(`刪除廠商「${v.name}」？`)) return
    await fetch('/api/fin/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) }); reload()
  }
  const copyLink = (v: Vendor) => { navigator.clipboard?.writeText(`${origin}/vendor/${v.fill_token}`); alert('已複製廠商填報連結') }
  const toggleRegion = (r: string) => setEditing(e => {
    if (!e) return e
    const cur = e.regions ?? []
    return { ...e, regions: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">瓦斯＝1 家(全部門市)；冰塊＝多家(依區域)。每家一條私密填報連結。</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入廠商 (Excel/CSV)
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', service: 'ice', regions: [], active: true })}><Plus className="h-4 w-4" />新增廠商</Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入廠商資料"
          description="支援 .xlsx, .xls 與 .csv 檔案。若統編或廠商名稱相符將自動更新。"
          columns={VENDOR_IMPORT_COLUMNS}
          templateFilename="廠商資料範本"
          sheetName="廠商名冊"
          onClose={() => setShowImport(false)}
          onSuccess={reload}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/vendors/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : vendors.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無廠商</div>
        : <div className="grid gap-2">{vendors.map(v => (
          <Card key={v.id} className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{v.name} <span className="text-xs text-gray-400 ml-1">{v.service === 'gas' ? '瓦斯' : '冰塊'}</span>{!v.active && <span className="text-xs text-red-400 ml-1">停用</span>}</div>
              <div className="text-xs text-gray-500">{v.service === 'gas' ? '全部門市' : (v.regions.length ? `區域：${v.regions.join('、')}` : '（未指定區域＝全部）')}</div>
            </div>
            <div className="flex gap-1 shrink-0 flex-wrap justify-end">
              <button onClick={() => copyLink(v)} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200">複製填報連結</button>
              <button onClick={() => setEditing({ ...v })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
              <button onClick={() => remove(v)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>))}</div>}

      {editing && (
        <Modal title={editing.id ? '編輯廠商' : '新增廠商'} onClose={() => setEditing(null)}>
          <Field label="廠商名稱 *"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="服務別">
            <select value={editing.service ?? 'ice'} onChange={e => setEditing({ ...editing, service: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="gas">瓦斯（涵蓋全部門市）</option><option value="ice">冰塊（依區域）</option>
            </select>
          </Field>
          {editing.service === 'ice' && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">涵蓋區域（不選＝全部）</span>
              <div className="flex flex-wrap gap-1.5">
                {regions.length === 0 && <span className="text-xs text-gray-400">尚無區域，請先於門市設定區域</span>}
                {regions.map(r => (
                  <button key={r} onClick={() => toggleRegion(r)} type="button"
                    className={`text-xs px-2 py-1 rounded border ${(editing.regions ?? []).includes(r) ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground'}`}>{r}</button>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} />啟用</label>
          <ModalActions busy={busy} disabled={!editing.name?.trim()} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  )
}

// ── 月度費用格 ──
interface GridStore { code: string; name: string; region: string }
interface GridCat { code: string; name: string; entry_method: string; vendor_service: string }
interface Bill { store_code: string; category_code: string; amount: number; source: string }

const billKey = (s: string, c: string) => `${s}|${c}`

function BillsTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [stores, setStores] = useState<GridStore[]>([])
  const [cats, setCats] = useState<GridCat[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({}) // `${store}|${cat}` → amount
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/fin/bills?year=${year}&month=${month}`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive) return
      if (d) {
        setStores(d.stores ?? []); setCats(d.categories ?? [])
        const m: Record<string, number> = {}
        for (const b of (d.bills ?? []) as Bill[]) m[billKey(b.store_code, b.category_code)] = Number(b.amount) || 0
        setAmounts(m)
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [year, month, tick])

  const saveCell = async (store_code: string, category_code: string, amount: number) => {
    setAmounts(p => ({ ...p, [billKey(store_code, category_code)]: amount }))
    await fetch('/api/fin/bills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_code, category_code, year, month, amount, source: 'manual' }),
    })
  }

  const doImport = async () => {
    const rows = importText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const [store_code, category_code, amount] = l.split(/[,\t]/).map(x => x.trim())
      return { store_code, category_code, amount }
    })
    if (rows.length === 0) { setMsg('沒有資料'); return }
    setImporting(true)
    const res = await fetch('/api/fin/bills/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, rows }),
    })
    setImporting(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(`匯入 ${d.imported} 筆`); setShowImport(false); setImportText(''); reload() } else setMsg(d.error ?? '匯入失敗')
  }

  const colTotal = (c: string) => stores.reduce((s, st) => s + (amounts[billKey(st.code, c)] ?? 0), 0)
  const rowTotal = (s: string) => cats.reduce((sum, c) => sum + (amounts[billKey(s, c.code)] ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y} 年</option>)}</select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}</select>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => setShowImport(v => !v)}><Upload className="h-4 w-4" />水電匯入</Button>
        {msg && <span className="text-sm text-blue-600">{msg}</span>}
      </div>

      {showImport && (
        <Card className="p-3 space-y-2">
          <p className="text-xs text-gray-500">每行一筆：<code>門市編碼,科目編碼,金額</code>（可貼 Excel 兩欄，用逗號或 Tab 分隔）。科目如 WATER/ELEC。</p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5} className="w-full rounded-md border px-2 py-1.5 text-sm font-mono" placeholder={'YL,WATER,1200000\nYL,ELEC,3400000'} />
          <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setShowImport(false)}>取消</Button><Button size="sm" onClick={doImport} disabled={importing}>{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : '匯入'}</Button></div>
        </Card>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : stores.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無門市，請先到「門市／區域」新增。</div>
        : <div className="overflow-x-auto"><table className="text-sm border-collapse">
          <thead><tr className="text-gray-500 border-b">
            <th className="text-left py-2 pr-3 sticky left-0 bg-card">門市</th>
            {cats.map(c => <th key={c.code} className="px-2 text-right whitespace-nowrap">{c.name || c.code}</th>)}
            <th className="px-2 text-right">合計</th>
          </tr></thead>
          <tbody>{stores.map(st => (
            <tr key={st.code} className="border-b last:border-0">
              <td className="py-1 pr-3 sticky left-0 bg-card"><span className="font-medium">{st.code}</span>{st.region && <span className="text-gray-400 text-xs ml-1">{st.region}</span>}</td>
              {cats.map(c => (
                <td key={c.code} className="px-1">
                  <input type="number" value={amounts[billKey(st.code, c.code)] ?? ''}
                    onChange={e => setAmounts(p => ({ ...p, [billKey(st.code, c.code)]: Number(e.target.value) || 0 }))}
                    onBlur={e => saveCell(st.code, c.code, Number(e.target.value) || 0)}
                    className="w-24 h-8 rounded border px-1.5 text-right tabular-nums" />
                </td>
              ))}
              <td className="px-2 text-right tabular-nums font-medium">{fmt(rowTotal(st.code))}</td>
            </tr>))}
            <tr className="border-t font-medium">
              <td className="py-2 pr-3 sticky left-0 bg-card">合計</td>
              {cats.map(c => <td key={c.code} className="px-2 text-right tabular-nums">{fmt(colTotal(c.code))}</td>)}
              <td className="px-2 text-right tabular-nums">{fmt(stores.reduce((s, st) => s + rowTotal(st.code), 0))}</td>
            </tr>
          </tbody></table></div>}
      <p className="text-xs text-gray-400">直接在格子輸入金額，離開欄位自動儲存。瓦斯/冰塊之後會由廠商填（階段 3）。</p>
    </div>
  )
}

// ── 收支報表 ──
interface Rep { income: number; expense: number; net: number; expense_cash: number; bills_total: number; expense_rows: { name: string; amount: number; kind: string }[] }

function ReportTab() {
  const now = new Date()
  const [stores, setStores] = useState<GridStore[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rep, setRep] = useState<Rep | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/fin/stores').then(r => r.ok ? r.json() : null).then(d => setStores(d?.stores ?? []))
  }, [])
  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/fin/report?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    setRep(res.ok ? await res.json() : null)
    setLoading(false)
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={store} onChange={e => setStore(e.target.value)} className="h-9 rounded-md border px-2 text-sm">
          <option value="">全部門市</option>
          {stores.map(s => <option key={s.code} value={s.code}>{s.code}{s.name ? ` ${s.name}` : ''}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y} 年</option>)}</select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}</select>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : !rep ? <div className="text-center py-10 text-gray-400 text-sm">無資料</div>
        : <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3"><div className="text-xs text-gray-500">收入</div><div className="text-xl font-bold text-green-600 tabular-nums">{fmt(rep.income)}</div></Card>
            <Card className="p-3"><div className="text-xs text-gray-500">支出（含費用）</div><div className="text-xl font-bold text-red-500 tabular-nums">{fmt(rep.expense)}</div></Card>
            <Card className="p-3"><div className="text-xs text-gray-500">淨額</div><div className={`text-xl font-bold tabular-nums ${rep.net < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(rep.net)}</div></Card>
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">支出明細</h3>
            <p className="text-xs text-gray-400 mb-2">月度費用（水電瓦斯冰塊等）{fmt(rep.bills_total)}　+　日常支出 {fmt(rep.expense_cash)}</p>
            {rep.expense_rows.length === 0 ? <p className="text-sm text-gray-400">無支出</p>
              : <table className="w-full text-sm"><tbody>{rep.expense_rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5">{r.name} {r.kind === 'bill' && <span className="text-[10px] text-gray-400">月度費用</span>}</td>
                  <td className="text-right tabular-nums text-red-500">{fmt(r.amount)}</td>
                </tr>))}</tbody></table>}
          </Card>
        </>}
    </div>
  )
}

function StoresTab() {
  const [rows, setRows] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<StoreRow> | null>(null)
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fin/stores')
    if (res.ok) setRows((await res.json()).stores ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.code?.trim()) return
    setBusy(true)
    const res = await fetch('/api/fin/stores', {
      method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (r: StoreRow) => {
    if (!confirm(`刪除門市「${r.code}」？`)) return
    await fetch('/api/fin/stores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }

  const regions = [...new Set(rows.map(r => r.region).filter(Boolean))]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">每個門市有編碼與所屬區域（冰塊廠商依區域涵蓋）。</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入門市 (Excel/CSV)
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ code: '', name: '', region: '', active: true })}><Plus className="h-4 w-4" />新增門市</Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入門市 / 區域"
          description="支援 .xlsx, .xls 與 .csv 檔案。若門市代碼相符將自動更新。"
          columns={STORE_IMPORT_COLUMNS}
          templateFilename="門市資料範本"
          sheetName="門市清單"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/stores/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無門市</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">編碼</th><th className="pr-2">名稱</th><th className="pr-2">區域</th><th className="pr-2">狀態</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-2 font-medium">{r.code}</td>
              <td className="pr-2">{r.name}</td>
              <td className="pr-2 text-gray-500">{r.region || '—'}</td>
              <td className="pr-2">{r.active ? <span className="text-emerald-600 text-xs">啟用</span> : <span className="text-gray-400 text-xs">停用</span>}</td>
              <td className="text-right whitespace-nowrap">
                <button onClick={() => setEditing({ ...r })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
                <button onClick={() => remove(r)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4 inline" /></button>
              </td>
            </tr>))}</tbody></table></div>}

      {editing && (
        <Modal title={editing.id ? '編輯門市' : '新增門市'} onClose={() => setEditing(null)}>
          <Field label="門市編碼 *"><Input value={editing.code ?? ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>
          <Field label="名稱"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="區域"><Input list="region-list" value={editing.region ?? ''} onChange={e => setEditing({ ...editing, region: e.target.value })} />
            <datalist id="region-list">{regions.map(r => <option key={r} value={r} />)}</datalist>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} />啟用</label>
          <ModalActions busy={busy} disabled={!editing.code?.trim()} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  )
}

function CategoriesTab() {
  const [rows, setRows] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<CatRow> | null>(null)
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fin/categories')
    if (res.ok) setRows((await res.json()).categories ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.code?.trim()) return
    setBusy(true)
    const res = await fetch('/api/fin/categories', {
      method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (r: CatRow) => {
    if (!confirm(`刪除科目「${r.name || r.code}」？`)) return
    await fetch('/api/fin/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">水電＝人工匯入；瓦斯/冰塊＝廠商填。可自訂新增。</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入科目 (Excel/CSV)
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ code: '', name: '', entry_method: 'manual', vendor_service: '', sort: 0 })}><Plus className="h-4 w-4" />新增科目</Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入費用科目"
          description="支援 .xlsx, .xls 與 .csv 檔案。若科目代碼相符將自動更新。"
          columns={CATEGORY_IMPORT_COLUMNS}
          templateFilename="費用科目範本"
          sheetName="科目清單"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/categories/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">編碼</th><th className="pr-2">名稱</th><th className="pr-2">填寫方式</th><th className="pr-2">廠商別</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-2 font-medium">{r.code}</td>
              <td className="pr-2">{r.name}</td>
              <td className="pr-2 text-gray-500">{METHOD_LABEL[r.entry_method] ?? r.entry_method}</td>
              <td className="pr-2 text-gray-500">{r.entry_method === 'vendor' ? (SERVICE_LABEL[r.vendor_service] ?? r.vendor_service) : '—'}</td>
              <td className="text-right whitespace-nowrap">
                <button onClick={() => setEditing({ ...r })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
                <button onClick={() => remove(r)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4 inline" /></button>
              </td>
            </tr>))}</tbody></table></div>}

      {editing && (
        <Modal title={editing.id ? '編輯科目' : '新增科目'} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="科目編碼 *"><Input value={editing.code ?? ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>
            <Field label="名稱"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="填寫方式">
              <select value={editing.entry_method ?? 'manual'} onChange={e => setEditing({ ...editing, entry_method: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                <option value="import">人工匯入</option><option value="vendor">廠商填</option><option value="manual">手動</option>
              </select>
            </Field>
            {editing.entry_method === 'vendor' && (
              <Field label="廠商別">
                <select value={editing.vendor_service ?? ''} onChange={e => setEditing({ ...editing, vendor_service: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                  <option value="">選擇…</option><option value="gas">瓦斯（1 家）</option><option value="ice">冰塊（分區）</option>
                </select>
              </Field>
            )}
          </div>
          <ModalActions busy={busy} disabled={!editing.code?.trim()} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  )
}

// ── 共用小元件 ──
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs text-gray-500">{label}</span>{children}</label>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>
        {children}
      </div>
    </div>
  )
}
function ModalActions({ busy, disabled, onCancel, onSave }: { busy: boolean; disabled: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
      <Button size="sm" onClick={onSave} disabled={busy || disabled}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button>
    </div>
  )
}
