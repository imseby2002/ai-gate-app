'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { FlaskConical, ArrowLeft, Loader2, AlertCircle, Upload, Download, Plus, Trash2, Save, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')
const fmt1 = (n: number) => (Math.round(Number(n) * 10) / 10).toLocaleString('zh-TW')

interface RecipeLite { id: string; name: string; cup_size: string; total_export: number; total_purchase: number; unit_cost_export: number; unit_cost_purchase: number; source: string }
interface Item { id?: string; material_name: string; unit: string; qty: number; price_export: number; price_purchase: number; amount_export: number; amount_purchase: number }
interface RecipeFull { id: string; name: string; cup_size: string; category: string; note: string; total_export: number; total_purchase: number; unit_cost_export: number; unit_cost_purchase: number; unit_label: string; source: string }

export default function RdRecipesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [recipes, setRecipes] = useState<RecipeLite[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<boolean>(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [tick, setTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    fetch('/api/rd/recipes').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) setRecipes(d.recipes ?? []); setLoading(false) })
  }, [tick])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅研發單位可使用研發配方</p></div>
    </div>
  )

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading(true); setMsg('解析中…')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/rd/import', { method: 'POST', body: fd })
    setUploading(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `匯入 ${d.imported} 個配方（${d.sheet}）` : (d.error ?? '匯入失敗'))
    if (res.ok) reload()
  }

  const filtered = recipes.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={upload} />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><FlaskConical className="h-5 w-5 text-purple-600" /></div>
        <div>
          <h1 className="text-2xl font-bold">研發配方（成本）</h1>
          <p className="text-sm text-gray-500">單一配方輸入或配方表上傳，所有配方一起匯出</p>
        </div>
        <div className="ml-auto"><Link href="/rd"><Button variant="outline" size="sm" className="gap-1.5"><FlaskConical className="h-4 w-4 text-purple-600" />配方與成本中心</Button></Link></div>
      </div>

      <div className="bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-purple-900 dark:text-purple-200">
          <span className="font-bold">配方與配方成本已全面合一：</span>
          研發中心已將配方設計、原料進價抓取、每杯成本計算與 POS 成品對照合而為一。
        </div>
        <Link href="/rd" className="shrink-0">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7">
            前往配方與成本中心
          </Button>
        </Link>
      </div>

      {sel ? <RecipeDetail id={sel} onBack={() => setSel(null)} onChanged={reload} />
        : editing ? <RecipeEditor onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />
        : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入配方表(.xlsx)</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open('/api/rd/export')}><Download className="h-4 w-4" />全部匯出</Button>
              <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setEditing(true)}><Plus className="h-4 w-4" />單一配方輸入</Button>
              {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
            </div>
            <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋配方名稱…" className="pl-9" /></div>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              : filtered.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無配方，上傳配方表或新增。</div>
              : <div className="grid gap-2">{filtered.map(r => (
                <button key={r.id} onClick={() => setSel(r.id)} className="text-left w-full">
                  <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="font-medium">{r.name}</span>{r.cup_size && <span className="text-xs text-gray-400">{r.cup_size}</span>}
                        {r.source === 'import' && <span className="text-[11px] px-1.5 rounded bg-gray-100 text-gray-500">匯入</span>}</div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">成本 {fmt(r.total_purchase)}{r.unit_cost_purchase ? `・單位 ${fmt(r.unit_cost_purchase)}` : ''}</span>
                  </Card>
                </button>))}</div>}
            <p className="text-xs text-gray-400">共 {recipes.length} 個配方。配方表上傳格式：xlsx 內「Bảng tính giá vốn SP đồ uống」工作表。內部成本數字由中央廚房售價表帶入。</p>
          </div>
        )}
    </div>
  )
}

function RecipeDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ recipe: RecipeFull; items: Item[] } | null>(null)
  useEffect(() => { fetch(`/api/rd/recipes?id=${id}`).then(r => r.ok ? r.json() : null).then(setData) }, [id])
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  const r = data.recipe
  const remove = async () => { if (!confirm(`刪除配方「${r.name}」？`)) return; await fetch('/api/rd/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); onChanged(); onBack() }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />返回清單</button>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div><h3 className="font-semibold">{r.name}</h3><p className="text-xs text-gray-400">{r.cup_size}{r.unit_label ? `・${r.unit_label}` : ''}</p></div>
          <button onClick={remove} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"><Trash2 className="h-4 w-4" />刪除</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">用量</th><th className="pr-2 text-right">出價</th><th className="pr-2 text-right">進價</th><th className="pr-2 text-right">出額</th><th className="pr-2 text-right">進額</th></tr></thead>
            <tbody>{data.items.map((it, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 pr-2">{it.material_name}</td><td className="pr-2 text-gray-400">{it.unit}</td>
                <td className="pr-2 text-right tabular-nums">{fmt1(it.qty)}</td>
                <td className="pr-2 text-right tabular-nums text-gray-500">{fmt(it.price_export)}</td>
                <td className="pr-2 text-right tabular-nums text-gray-500">{fmt(it.price_purchase)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(it.amount_export)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(it.amount_purchase)}</td>
              </tr>))}</tbody>
            <tfoot><tr className="font-medium border-t"><td className="py-1.5 pr-2" colSpan={5}>合計</td><td className="pr-2 text-right tabular-nums">{fmt(r.total_export)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.total_purchase)}</td></tr>
              {(r.unit_cost_export || r.unit_cost_purchase) ? <tr className="text-purple-600"><td className="py-1 pr-2" colSpan={5}>{r.unit_label || '單位成本'}</td><td className="pr-2 text-right tabular-nums">{fmt(r.unit_cost_export)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.unit_cost_purchase)}</td></tr> : null}</tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

function RecipeEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [cupSize, setCupSize] = useState('')
  const [items, setItems] = useState<Partial<Item>[]>([{ material_name: '', unit: '', qty: 0, price_export: 0, price_purchase: 0 }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const setItem = (i: number, patch: Partial<Item>) => setItems(p => p.map((it, x) => x === i ? { ...it, ...patch } : it))

  const save = async () => {
    if (!name.trim()) { setErr('配方名稱必填'); return }
    setBusy(true); setErr('')
    const res = await fetch('/api/rd/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, cup_size: cupSize, items }) })
    setBusy(false)
    if (res.ok) onSaved(); else setErr((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />返回清單</button>
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">配方名稱 *</span><Input value={name} onChange={e => setName(e.target.value)} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">杯型／分類</span><Input value={cupSize} onChange={e => setCupSize(e.target.value)} className="h-9" /></label>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">原料</span><button onClick={() => setItems(p => [...p, { material_name: '', unit: '', qty: 0, price_export: 0, price_purchase: 0 }])} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">＋原料</button></div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 items-center">
              <Input value={it.material_name ?? ''} onChange={e => setItem(i, { material_name: e.target.value })} placeholder="原料" className="h-8 col-span-4" />
              <Input value={it.unit ?? ''} onChange={e => setItem(i, { unit: e.target.value })} placeholder="單位" className="h-8 col-span-2" />
              <Input type="number" value={String(it.qty ?? '')} onChange={e => setItem(i, { qty: Number(e.target.value) || 0 })} placeholder="用量" className="h-8 col-span-2" />
              <Input type="number" value={String(it.price_purchase ?? '')} onChange={e => setItem(i, { price_purchase: Number(e.target.value) || 0 })} placeholder="進價" className="h-8 col-span-3" />
              <button onClick={() => setItems(p => p.filter((_, x) => x !== i))} className="text-gray-400 hover:text-red-500 col-span-1"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={onClose}>取消</Button><Button size="sm" onClick={save} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存</Button></div>
      </Card>
    </div>
  )
}
