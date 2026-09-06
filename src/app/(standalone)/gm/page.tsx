'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Crown, AlertTriangle, TrendingUp, Wrench, FileWarning, Users, ShieldCheck, LayoutDashboard, FileText, Send, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StoreRow { code: string; name: string; revenue: number; gross_profit: number; store_profit: number; profit: number; gross_margin: number; net_margin: number }
interface Finance { period: string; stores: StoreRow[]; total: { revenue: number; gross_profit: number; store_profit: number; profit: number } }
interface Flag { dept: string; level: 'urgent' | 'warn' | 'info'; text: string }
interface Data {
  period: string; finance: Finance | null
  repair: { open: number; overdue: number; warranty_soon: number }
  affairs: { expiring: { title: string; doc_type: string; expiry_date: string; days: number }[]; count: number }
  hr: { active: number; new_this_month: number; contracts_expiring: number }
  audit: { active_rules: number }
  marketing: { delivery_revenue: number; delivery_orders: number; content_review: number; offline_active: number }
  flags: Flag[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const pct = (n: number) => (n * 100).toFixed(1) + '%'
const FLAG_CLASS: Record<string, string> = {
  urgent: 'border-red-300 bg-red-50 text-red-700', warn: 'border-amber-300 bg-amber-50 text-amber-700', info: 'border-sky-300 bg-sky-50 text-sky-700',
}
const FLAG_LABEL: Record<string, string> = { urgent: '緊急', warn: '注意', info: '提醒' }

type Tab = 'dashboard' | 'reports'

export default function GmPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

  useEffect(() => { fetch('/api/gm/dashboard').then(r => setAllowed(r.status !== 403)) }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅總經理室可使用</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Crown className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">總經理室</h1>
          <p className="text-sm text-muted-foreground">全公司彙整・異常紅旗・AI 經營快報</p>
        </div>
        <div className="ml-auto"><Link href="/office"><Button variant="outline" size="sm">返回</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([['dashboard', '經營儀表板', <LayoutDashboard key="d" className="h-4 w-4" />], ['reports', '每日快報', <FileText key="r" className="h-4 w-4" />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{label}</button>
        ))}
      </div>

      {tab === 'dashboard' ? <DashboardTab /> : <ReportsTab />}
    </div>
  )
}

function DashboardTab() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/gm/dashboard').then(async r => { if (r.ok) setData(await r.json().catch(() => null)); setLoading(false) }) }, [])
  if (loading || !data) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const f = data.finance
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" />需要注意（{data.flags.length}）{data.period && <span className="text-xs font-normal text-muted-foreground">損益期間 {data.period}</span>}</h2>
        {data.flags.length === 0 ? <p className="text-sm text-muted-foreground">目前無異常。</p> : (
          <div className="space-y-1.5">
            {data.flags.map((fl, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${FLAG_CLASS[fl.level]}`}>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/60">{FLAG_LABEL[fl.level]}</span>
                <span className="text-xs font-medium opacity-70">{fl.dept}</span>
                <span>{fl.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="本期營業額" value={f ? fmt(f.total.revenue) : '—'} sub={f ? `淨利 ${fmt(f.total.profit)}` : ''} />
        <Kpi icon={<Wrench className="h-4 w-4" />} label="進行中工單" value={String(data.repair.open)} sub={data.repair.overdue ? `逾期 ${data.repair.overdue}` : '無逾期'} />
        <Kpi icon={<FileWarning className="h-4 w-4" />} label="文件將到期" value={String(data.affairs.count)} sub="30 天內" />
        <Kpi icon={<Users className="h-4 w-4" />} label="在職人數" value={String(data.hr.active)} sub={`本月新進 ${data.hr.new_this_month}`} />
        <Kpi icon={<Megaphone className="h-4 w-4" />} label="外送當月營收" value={fmt(data.marketing.delivery_revenue)} sub={`訂單 ${fmt(data.marketing.delivery_orders)}`} />
      </section>

      {f && f.stores.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" />各門市損益（{f.period}）</h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">門市</th>
                  <th className="px-3 py-2 font-medium text-right">營業額</th>
                  <th className="px-3 py-2 font-medium text-right">毛利</th>
                  <th className="px-3 py-2 font-medium text-right">毛利率</th>
                  <th className="px-3 py-2 font-medium text-right">淨利</th>
                  <th className="px-3 py-2 font-medium text-right">淨利率</th>
                </tr>
              </thead>
              <tbody>
                {f.stores.map(s => (
                  <tr key={s.code} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.revenue)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.gross_profit)}</td>
                    <td className="px-3 py-2 text-right">{pct(s.gross_margin)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${s.profit < 0 ? 'text-red-600' : ''}`}>{fmt(s.profit)}</td>
                    <td className={`px-3 py-2 text-right ${s.profit < 0 ? 'text-red-600' : ''}`}>{pct(s.net_margin)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right">{fmt(f.total.revenue)}</td>
                  <td className="px-3 py-2 text-right">{fmt(f.total.gross_profit)}</td>
                  <td className="px-3 py-2 text-right">{f.total.revenue ? pct(f.total.gross_profit / f.total.revenue) : '—'}</td>
                  <td className={`px-3 py-2 text-right ${f.total.profit < 0 ? 'text-red-600' : ''}`}>{fmt(f.total.profit)}</td>
                  <td className="px-3 py-2 text-right">{f.total.revenue ? pct(f.total.profit / f.total.revenue) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.affairs.expiring.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold"><FileWarning className="h-4 w-4 text-amber-500" />文件到期提醒</h2>
          <div className="rounded-xl border bg-card divide-y">
            {data.affairs.expiring.map((d, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">{d.title || d.doc_type}<span className="ml-2 text-xs text-muted-foreground">{d.doc_type}</span></span>
                <span className="text-muted-foreground">{d.expiry_date}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${d.days < 0 ? 'bg-red-100 text-red-700' : d.days <= 14 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                  {d.days < 0 ? `逾期 ${-d.days} 天` : `${d.days} 天`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <MiniStat icon={<Wrench className="h-4 w-4" />} label="設備保固將到期" value={data.repair.warranty_soon} />
        <MiniStat icon={<Users className="h-4 w-4" />} label="合約 60 天內到期" value={data.hr.contracts_expiring} />
        <MiniStat icon={<ShieldCheck className="h-4 w-4" />} label="稽核硬性規定" value={data.audit.active_rules} />
        <MiniStat icon={<Megaphone className="h-4 w-4" />} label="行銷內容待審核" value={data.marketing.content_review} />
      </section>
    </div>
  )
}

interface Report { id: string; kind: string; report_date: string; title: string; content: string; channels: string; created_at: string }

const REPORT_KIND_LABEL: Record<string, string> = { daily: '每日快報', weekly: '每週彙整', monthly: '月度報告' }

function ReportsTab() {
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily')
  const [items, setItems] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [gen, setGen] = useState(false)
  const [msg, setMsg] = useState('')

  async function load(k: string) {
    setLoading(true)
    const r = await fetch('/api/gm/reports?kind=' + k)
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }
  useEffect(() => { load(kind) }, [kind])

  async function generate() {
    setGen(true); setMsg('')
    const r = await fetch('/api/gm/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
    const j = await r.json().catch(() => ({}))
    setGen(false)
    if (!r.ok) { setMsg(j.error || '產生失敗'); return }
    setMsg(`已產生並推播：${(j.channels ?? []).join('、') || '站內'}`)
    load(kind)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={e => setKind(e.target.value as 'daily' | 'weekly')} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="daily">每日快報</option>
          <option value="weekly">每週彙整</option>
        </select>
        <p className="text-sm text-muted-foreground flex-1 min-w-[12rem]">AI 經營報告，推播至總經理（站內／Telegram／Email）。管道於外務設定的「總經理室」欄位設定。</p>
        <Button size="sm" className="gap-1.5" onClick={generate} disabled={gen}>{gen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}立即產生{REPORT_KIND_LABEL[kind]}</Button>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無報告。每日 08:00／每週一 08:00（台北）自動產生，或按上方按鈕立即產生。</div>
        : (
          <div className="space-y-3">
            {items.map(r => (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.title}</span>
                  {r.channels && <span className="text-xs text-muted-foreground">推播：{r.channels}</span>}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  )
}
