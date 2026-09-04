'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Crown, AlertTriangle, TrendingUp, Wrench, FileWarning, Users, ShieldCheck } from 'lucide-react'
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
  flags: Flag[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const pct = (n: number) => (n * 100).toFixed(1) + '%'
const FLAG_CLASS: Record<string, string> = {
  urgent: 'border-red-300 bg-red-50 text-red-700', warn: 'border-amber-300 bg-amber-50 text-amber-700', info: 'border-sky-300 bg-sky-50 text-sky-700',
}
const FLAG_LABEL: Record<string, string> = { urgent: '緊急', warn: '注意', info: '提醒' }

export default function GmPage() {
  const [data, setData] = useState<Data | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gm/dashboard').then(async r => {
      if (r.status === 403) { setAllowed(false); setLoading(false); return }
      setAllowed(true)
      setData(await r.json().catch(() => null))
      setLoading(false)
    })
  }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅總經理室可使用</p></div>
    </div>
  )
  if (loading || !data) return <div className="flex h-full items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const f = data.finance

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Crown className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">經營儀表板</h1>
          <p className="text-sm text-muted-foreground">全公司彙整・異常紅旗{data.period ? `　損益期間 ${data.period}` : ''}</p>
        </div>
        <div className="ml-auto"><Link href="/office"><Button variant="outline" size="sm">返回</Button></Link></div>
      </div>

      {/* 紅旗異常 */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" />需要注意（{data.flags.length}）</h2>
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

      {/* KPI 卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="本期營業額" value={f ? fmt(f.total.revenue) : '—'} sub={f ? `淨利 ${fmt(f.total.profit)}` : ''} />
        <Kpi icon={<Wrench className="h-4 w-4" />} label="進行中工單" value={String(data.repair.open)} sub={data.repair.overdue ? `逾期 ${data.repair.overdue}` : '無逾期'} />
        <Kpi icon={<FileWarning className="h-4 w-4" />} label="文件將到期" value={String(data.affairs.count)} sub="30 天內" />
        <Kpi icon={<Users className="h-4 w-4" />} label="在職人數" value={String(data.hr.active)} sub={`本月新進 ${data.hr.new_this_month}`} />
      </section>

      {/* 各門市損益 */}
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

      {/* 外務文件到期 */}
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

      {/* 其他部門摘要 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <MiniStat icon={<Wrench className="h-4 w-4" />} label="設備保固將到期" value={data.repair.warranty_soon} />
        <MiniStat icon={<Users className="h-4 w-4" />} label="合約 60 天內到期" value={data.hr.contracts_expiring} />
        <MiniStat icon={<ShieldCheck className="h-4 w-4" />} label="稽核硬性規定" value={data.audit.active_rules} />
        <MiniStat icon={<FileWarning className="h-4 w-4" />} label="文件到期(全)" value={data.affairs.count} />
      </section>
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
