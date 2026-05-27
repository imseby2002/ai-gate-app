'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, Users } from 'lucide-react'

interface Customer {
  id: string
  platform: string
  from_id: string
  industry: string
  name: string | null
  stage: string
  price_ask_count: number
  message_count: number
  last_intent: string | null
  summary: string | null
  last_message_at: string
  first_seen_at: string
}

const STAGES: { key: string; label: string; cls: string }[] = [
  { key: 'new',         label: '新客',    cls: 'bg-gray-100 text-gray-600' },
  { key: 'inquiring',   label: '洽詢中',  cls: 'bg-blue-100 text-blue-700' },
  { key: 'quoted',      label: '已報價',  cls: 'bg-amber-100 text-amber-700' },
  { key: 'negotiating', label: '議價中',  cls: 'bg-orange-100 text-orange-700' },
  { key: 'won',         label: '已成交',  cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'lost',        label: '流失',    cls: 'bg-rose-100 text-rose-700' },
]
const stageOf = (s: string) => STAGES.find(x => x.key === s) ?? STAGES[0]

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return ts }
}

export function CsCustomers({ initialIndustry }: { initialIndustry?: string }) {
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<string>('')
  const industry = initialIndustry

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (industry) params.set('industry', industry)
      if (stage) params.set('stage', stage)
      const res = await fetch(`/api/marketing/cs-customers?${params.toString()}`)
      const data = await res.json()
      setRows(data.customers ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [industry, stage])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/cs" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-rose-500" />
              <h1 className="text-xl font-bold">客戶追蹤</h1>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
          </button>
        </div>

        {/* Stage filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStage('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${stage === '' ? 'bg-foreground text-background' : 'bg-card hover:bg-accent'}`}>
            全部
          </button>
          {STAGES.map(s => (
            <button key={s.key} onClick={() => setStage(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${stage === s.key ? 'bg-foreground text-background' : 'bg-card hover:bg-accent'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              尚無客戶資料。<br />
              <span className="text-xs">客戶透過 LINE 等通路對話後會自動出現在這裡。</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="px-4 py-3 font-medium">客戶</th>
                    <th className="px-4 py-3 font-medium">階段</th>
                    <th className="px-4 py-3 font-medium text-center">問價</th>
                    <th className="px-4 py-3 font-medium text-center">訊息</th>
                    <th className="px-4 py-3 font-medium">最後洽詢</th>
                    <th className="px-4 py-3 font-medium">最後聯絡</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const st = stageOf(r.stage)
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.name || r.from_id}</div>
                          <div className="text-[11px] text-muted-foreground">{r.platform}{r.summary ? ` · ${r.summary}` : ''}</div>
                        </td>
                        <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3 text-center tabular-nums">{r.price_ask_count}</td>
                        <td className="px-4 py-3 text-center tabular-nums">{r.message_count}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.last_intent ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(r.last_message_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">共 {rows.length} 位客戶 · 問價次數越多代表越接近成交，建議優先跟進議價中的客戶。</p>
        )}
      </div>
    </div>
  )
}
