'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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

const STAGE_CLS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600',
  inquiring: 'bg-blue-100 text-blue-700',
  quoted: 'bg-amber-100 text-amber-700',
  negotiating: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
}
const STAGE_KEYS = ['new', 'inquiring', 'quoted', 'negotiating', 'won', 'lost']

export function CsCustomers({ initialIndustry }: { initialIndustry?: string }) {
  const t = useTranslations('CsCustomers')
  const locale = useLocale()
  const stageLabel = (s: string) => t.has(`stages.${s}`) ? t(`stages.${s}`) : t('stages.new')
  const stageCls = (s: string) => STAGE_CLS[s] ?? STAGE_CLS.new
  const fmt = (ts: string) => {
    try {
      return new Date(ts).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    } catch { return ts }
  }
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
              <h1 className="text-xl font-bold">{t('title')}</h1>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {t('refresh')}
          </button>
        </div>

        {/* Stage filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStage('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${stage === '' ? 'bg-foreground text-background' : 'bg-card hover:bg-accent'}`}>
            {t('all')}
          </button>
          {STAGE_KEYS.map(k => (
            <button key={k} onClick={() => setStage(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${stage === k ? 'bg-foreground text-background' : 'bg-card hover:bg-accent'}`}>
              {stageLabel(k)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {t('empty1')}<br />
              <span className="text-xs">{t('empty2')}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="px-4 py-3 font-medium">{t('col.customer')}</th>
                    <th className="px-4 py-3 font-medium">{t('col.stage')}</th>
                    <th className="px-4 py-3 font-medium text-center">{t('col.priceAsk')}</th>
                    <th className="px-4 py-3 font-medium text-center">{t('col.messages')}</th>
                    <th className="px-4 py-3 font-medium">{t('col.lastIntent')}</th>
                    <th className="px-4 py-3 font-medium">{t('col.lastContact')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.name || r.from_id}</div>
                          <div className="text-[11px] text-muted-foreground">{r.platform}{r.summary ? ` · ${r.summary}` : ''}</div>
                        </td>
                        <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${stageCls(r.stage)}`}>{stageLabel(r.stage)}</span></td>
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
          <p className="text-xs text-muted-foreground text-center">{t('footer', { count: rows.length })}</p>
        )}
      </div>
    </div>
  )
}
