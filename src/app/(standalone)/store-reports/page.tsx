'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Store, Upload, Loader2, AlertCircle, TrendingUp, Package, Building2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

interface PosRow { product_code: string; product_name: string; qty: number; revenue: number }
interface MovRow {
  material_code: string; material_name: string; unit: string
  open_qty: number; in_total: number; in_value: number; out_total: number; out_value: number; close_qty: number; close_value: number
}
interface Report {
  store: string; year: number; month: number
  pos: { rows: PosRow[]; total_revenue: number; total_qty: number; product_count: number }
  inventory: { rows: MovRow[]; purchase_value: number; out_value: number; close_value: number; material_count: number }
}

export default function StoreReportsPage() {
  const now = new Date()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState('')
  const posRef = useRef<HTMLInputElement>(null)
  const invRef = useRef<HTMLInputElement>(null)

  const loadStores = useCallback(async () => {
    const res = await fetch('/api/inv/stores')
    if (res.status === 403) { setIsAdmin(false); return }
    setIsAdmin(true)
    const d = await res.json()
    setStores(d.stores ?? [])
    setStore(s => s || (d.stores?.[0] ?? ''))
  }, [])
  useEffect(() => { loadStores() }, [loadStores])

  const loadReport = useCallback(async () => {
    if (!store) { setReport(null); return }
    setLoading(true)
    const res = await fetch(`/api/inv/report?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    setReport(res.ok ? await res.json() : null)
    setLoading(false)
  }, [store, year, month])
  useEffect(() => { loadReport() }, [loadReport])

  const uploadPos = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!store.trim()) { setMsg('請先輸入或選擇門市'); return }
    setUploading('pos'); setMsg('')
    const fd = new FormData()
    fd.append('file', file); fd.append('store', store.trim()); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/pos', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(`POS 匯入 ${d.imported} 筆`); loadStores(); loadReport() }
    else setMsg(d.error ?? '匯入失敗')
  }

  const uploadInv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading('inv'); setMsg('')
    const fd = new FormData()
    fd.append('file', file); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/inventory', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(`進銷存匯入：${(d.stores ?? []).map((s: {store:string;count:number}) => `${s.store}(${s.count})`).join('、')}`); loadStores(); loadReport() }
    else setMsg(d.error ?? '匯入失敗')
  }

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2">
        <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
        <p className="font-semibold">僅管理者可使用門市報表</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <input ref={posRef} type="file" hidden accept=".xls" onChange={uploadPos} />
      <input ref={invRef} type="file" hidden accept=".xlsx" onChange={uploadInv} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Store className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市報表</h1>
          <p className="text-sm text-gray-500">每門市業績（POS）與支出／進銷存</p>
        </div>
        <div className="ml-auto">
          <Link href="/hr"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />人事管理</Button></Link>
        </div>
      </div>

      {/* 篩選 + 匯入 */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-gray-500">門市</span>
            <Input list="store-list" value={store} onChange={e => setStore(e.target.value)} placeholder="門市代碼（如 YL）" className="w-40" />
            <datalist id="store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-500">年</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
              {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-gray-500">月</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => posRef.current?.click()}>
              {uploading === 'pos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入 POS(.xls)
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => invRef.current?.click()}>
              {uploading === 'inv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入進銷存(.xlsx)
            </Button>
          </div>
        </div>
        {msg && <p className="text-sm text-blue-600">{msg}</p>}
        <p className="text-xs text-gray-400">POS 檔為單一門市，請先選門市；進銷存檔可含多門市（每工作表一門市，自動建立）。</p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !report || (report.pos.rows.length === 0 && report.inventory.rows.length === 0) ? (
        <div className="text-center py-10 text-gray-400 text-sm">此門市／月份尚無資料，請先匯入。</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="營收" value={fmt(report.pos.total_revenue)} tone="green" />
            <Stat icon={<Package className="h-4 w-4" />} label="總杯數" value={fmt(report.pos.total_qty)} />
            <Stat icon={<DollarSign className="h-4 w-4" />} label="進貨支出" value={fmt(report.inventory.purchase_value)} tone="red" />
            <Stat icon={<Package className="h-4 w-4" />} label="期末庫存值" value={fmt(report.inventory.close_value)} />
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">業績明細（{report.pos.product_count} 項）</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">產品</th><th className="pr-2 text-right">杯數</th><th className="pr-2 text-right">營收</th></tr></thead>
                <tbody>
                  {report.pos.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{r.product_name || r.product_code}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(r.qty)}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">進銷存明細（{report.inventory.material_count} 項）</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white">
                  <th className="py-2 pr-2">原料</th><th className="pr-2">單位</th>
                  <th className="pr-2 text-right">期初</th><th className="pr-2 text-right">入庫</th>
                  <th className="pr-2 text-right">出庫(用量)</th><th className="pr-2 text-right">剩餘</th><th className="pr-2 text-right">進貨額</th>
                </tr></thead>
                <tbody>
                  {report.inventory.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{r.material_name || r.material_code}</td>
                      <td className="pr-2 text-gray-400">{r.unit}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(r.open_qty)}</td>
                      <td className="pr-2 text-right tabular-nums text-blue-600">{fmt(r.in_total)}</td>
                      <td className="pr-2 text-right tabular-nums text-red-500">{fmt(r.out_total)}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(r.close_qty)}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(r.in_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : 'text-gray-800'
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</div>
    </Card>
  )
}
