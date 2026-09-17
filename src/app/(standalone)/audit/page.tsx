'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ClipboardCheck, Loader2, AlertCircle, Upload, Store, ShoppingCart, Boxes, Tag, FlaskConical, Gauge, Bell, Settings, MessageSquare, Plus, Trash2, ScrollText, Send, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'analysis' | 'chat' | 'sales' | 'balance' | 'prices' | 'recipes'
const fmt = (n: number, locale: string) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const now = new Date()

export default function AuditPage() {
  const t = useTranslations('Audit')
  const [ok, setOk] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('sales')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    fetch('/api/inv/stores').then(r => { if (r.status === 403) { setOk(false); return null } setOk(true); return r.json() })
      .then(d => { if (d) { setStores(d.stores ?? []); setStore(s => s || (d.stores?.[0] ?? '')) } })
  }, [])

  if (ok === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  const TABS: [Tab, string, ReactNode][] = [
    ['analysis', t('tabAnalysis'), <Gauge key="z" className="h-4 w-4" />],
    ['chat', t('tabChat'), <MessageSquare key="y" className="h-4 w-4" />],
    ['sales', t('tabSales'), <ShoppingCart key="a" className="h-4 w-4" />],
    ['balance', t('tabBalance'), <Boxes key="b" className="h-4 w-4" />],
    ['prices', t('tabPrices'), <Tag key="c" className="h-4 w-4" />],
    ['recipes', t('tabRecipes'), <FlaskConical key="d" className="h-4 w-4" />],
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardCheck className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/audit-platform">
            <Button size="sm" className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              <Scale className="h-3.5 w-3.5" />
              {t('auditPlatform')}
            </Button>
          </Link>
          <Link href="/audit-inspection">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-primary border-primary/30">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {t('inspection')}
            </Button>
          </Link>
          <Link href="/audit-ai">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              {t('discussAi')}
            </Button>
          </Link>
          <Link href="/audit-logs">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ScrollText className="h-3.5 w-3.5" />
              {t('auditLogs')}
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1"><span className="block text-xs text-gray-500">{t('store')}</span>
          <Input list="audit-stores" value={store} onChange={e => setStore(e.target.value)} className="w-36 h-9" placeholder={t('storePlaceholder')} />
          <datalist id="audit-stores">{stores.map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="space-y-1"><span className="block text-xs text-gray-500">{t('year')}</span><Input type="number" value={String(year)} onChange={e => setYear(Number(e.target.value) || year)} className="w-24 h-9" /></label>
        <label className="space-y-1"><span className="block text-xs text-gray-500">{t('month')}</span><Input type="number" value={String(month)} onChange={e => setMonth(Number(e.target.value) || month)} className="w-20 h-9" /></label>
        <span className="text-[11px] text-gray-400 ml-auto">{t('granularityHint')}</span>
      </Card>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'analysis' ? <AnalysisTab store={store} year={year} month={month} />
        : tab === 'chat' ? <ChatTab store={store} year={year} month={month} />
        : tab === 'sales' ? <SalesTab store={store} year={year} month={month} />
        : tab === 'balance' ? <BalanceTab store={store} year={year} month={month} />
        : tab === 'prices' ? <PricesTab />
        : <RecipesTab />}
    </div>
  )
}

function useUpload(url: string, extra: () => Record<string, string>, onDone: () => void) {
  const t = useTranslations('Audit')
  const ref = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setMsg(t('importing'))
    const fd = new FormData(); fd.append('file', file)
    for (const [k, v] of Object.entries(extra())) fd.append(k, v)
    const res = await fetch(url, { method: 'POST', body: fd })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('importedCount', { n: d.imported ?? d.total ?? '' }) : (d.error ?? t('importFailed')))
    if (res.ok) onDone()
  }
  return { ref, msg, busy, upload }
}

interface VarRow { material_code: string; material_name: string; unit: string; expected: number; actual: number; recipe_theo: number; remaining: number; diff: number; pct: number | null; over: boolean; price: number; money_loss: number }
interface Analysis {
  threshold: number; over_count: number; total_loss: number; rows: VarRow[]
  unmapped: { product_code: string; product_name: string; qty: number }[]
  cross_checks: { configured: boolean; cups_sold: number; cup_used: number | null; cup_diff: number | null; tea_used: number | null; creamer_used: number | null; ratio_actual: number | null; ratio_recipe: number | null; implied_cups_tea: number | null; implied_cups_creamer: number | null }
  possibility: { configured: boolean; has_displacement: boolean; extra_topping_servings: number; tea_explained: number; creamer_explained: number; tea_explained_pct: number | null; creamer_explained_pct: number | null; tea: { gap: number } | null; creamer: { gap: number } | null; toppings: { material_name: string; extra_servings: number }[] }
}
const pctStr = (p: number | null) => p === null ? '—' : `${p > 0 ? '+' : ''}${Math.round(p)}%`

function AnalysisTab({ store, year, month }: { store: string; year: number; month: number }) {
  const t = useTranslations('Audit')
  const locale = useLocale()
  const [data, setData] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showCfg, setShowCfg] = useState(false)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true); setMsg('')
    fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  const notify = async () => {
    setMsg(t('notifying'))
    const res = await fetch('/api/inv/variance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, year, month }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? (d.notified ? t('notifiedHr', { n: d.over_count }) : t('noOverItems')) : (d.error ?? t('notifyFailed')))
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (!data) return <div className="text-center py-8 text-gray-400 text-sm">{t('selectStoreYearMonthFirst')}</div>
  const cc = data.cross_checks, po = data.possibility

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">{t('overThreshold')} <b>{data.threshold}%</b>・{t('overCount')} <b className="text-red-600">{data.over_count}</b> {t('items')}・{t('estimatedLoss')} <b className="text-red-600">{fmt(data.total_loss, locale)}</b></span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCfg(v => !v)}><Settings className="h-4 w-4" />{t('settings')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-700 border-amber-200" onClick={notify}><Bell className="h-4 w-4" />{t('notifyHr')}</Button>
        </div>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {showCfg && <SettingsPanel onSaved={load} />}

      {cc.configured && (
        <Card className="p-3 text-sm grid sm:grid-cols-3 gap-2">
          <div>{t('cupsSold')}<b>{fmt(cc.cups_sold, locale)}</b>{cc.cup_used !== null && <>・{t('cupUsed')} <b>{fmt(cc.cup_used, locale)}</b>{cc.cup_diff !== null && <span className={Math.abs(cc.cup_diff) > 0 ? 'text-amber-600' : ''}>{t('diffSuffix', { amount: fmt(cc.cup_diff, locale) })}</span>}</>}</div>
          <div>{t('teaCreamerUsed', { tea: cc.tea_used === null ? '—' : fmt(cc.tea_used, locale), creamer: cc.creamer_used === null ? '—' : fmt(cc.creamer_used, locale) })}{cc.ratio_actual !== null && <>・{t('ratio')} {cc.ratio_actual.toFixed(2)}{cc.ratio_recipe !== null && <span className="text-gray-400">{t('recipeRatioSuffix', { ratio: cc.ratio_recipe.toFixed(2) })}</span>}</>}</div>
          <div>{t('impliedCups', { tea: cc.implied_cups_tea === null ? '—' : fmt(cc.implied_cups_tea, locale), creamer: cc.implied_cups_creamer === null ? '—' : fmt(cc.implied_cups_creamer, locale) })}</div>
        </Card>
      )}

      {po.configured && po.has_displacement && (
        <Card className="p-3 text-sm bg-sky-50 border-sky-200 space-y-1">
          <div className="font-medium text-sky-800">{t('displacementAnalysisTitle')}</div>
          <div>{t('displacementDetail', {
            teaGap: fmt(po.tea?.gap ?? 0, locale), teaExplained: fmt(po.tea_explained, locale),
            teaPct: po.tea_explained_pct !== null ? `（${Math.round(po.tea_explained_pct)}%）` : '',
            creamerGap: fmt(po.creamer?.gap ?? 0, locale), creamerExplained: fmt(po.creamer_explained, locale),
            creamerPct: po.creamer_explained_pct !== null ? `（${Math.round(po.creamer_explained_pct)}%）` : '',
          })}</div>
          <div className="text-xs text-sky-700">{t('extraToppingServings', { total: fmt(po.extra_topping_servings, locale) })}{po.toppings.length > 0 && t('extraToppingDetail', { list: po.toppings.slice(0, 4).map(tp => `${tp.material_name} ${fmt(tp.extra_servings, locale)}`).join('、') })}</div>
        </Card>
      )}

      <Card className="p-4">
        <div className="overflow-x-auto max-h-[26rem]">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white">
            <th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('expectedUsage')}</th><th className="pr-2 text-right">{t('actualUsage')}</th><th className="pr-2 text-right">{t('difference')}</th><th className="pr-2 text-right">{t('errorPct')}</th><th className="pr-2 text-right">{t('moneyLoss')}</th></tr></thead>
            <tbody>{data.rows.map(r => (
              <tr key={r.material_code} className={`border-b last:border-0 ${r.over ? 'bg-red-50' : ''}`}>
                <td className="py-1 pr-2">{r.material_name}{r.over && <span className="ml-1 text-[11px] text-red-600">{t('over')}</span>}</td>
                <td className="pr-2 text-gray-400">{r.unit}</td>
                <td className="pr-2 text-right tabular-nums text-gray-500">{fmt(r.expected, locale)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(r.actual, locale)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.diff > 0 ? 'text-red-600' : r.diff < 0 ? 'text-emerald-600' : ''}`}>{fmt(r.diff, locale)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.over ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{pctStr(r.pct)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.money_loss > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(r.money_loss, locale)}</td>
              </tr>))}</tbody></table>
        </div>
        {data.unmapped.length > 0 && <p className="text-[11px] text-amber-600 mt-2">{t('unmappedProducts', { n: data.unmapped.length, list: data.unmapped.slice(0, 3).map(u => u.product_name || u.product_code).join('、') })}</p>}
        <p className="text-[11px] text-gray-400 mt-1">{t('analysisFootnote')}</p>
      </Card>
    </div>
  )
}

interface Rule { id: string; store: string; rule: string; active: boolean }
interface Msg { role: string; content: string }

function ChatTab({ store, year, month }: { store: string; year: number; month: number }) {
  const t = useTranslations('Audit')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [chatId, setChatId] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [rules, setRules] = useState<Rule[]>([])
  const [newRule, setNewRule] = useState('')
  const [ruleScope, setRuleScope] = useState<'store' | 'all'>('store')

  const loadRules = useCallback(() => {
    if (!store) { setRules([]); return }
    fetch(`/api/audit/rules?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { rules: [] }).then(d => setRules(d.rules ?? []))
  }, [store])
  useEffect(() => { loadRules() }, [loadRules])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput(''); setMsgs(m => [...m, { role: 'user', content: text }]); setSending(true)
    // 取當月分析作為 AI 脈絡
    let analysis: unknown = null
    if (store) analysis = await fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : null).catch(() => null)
    const res = await fetch('/api/audit/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, store, message: text, analysis }) })
    setSending(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${d.error ?? t('failed')}` }]); return }
    setChatId(d.chat_id)
    setMsgs(m => [...m, { role: 'assistant', content: d.reply + (d.saved_rule ? t('savedAsRule', { rule: d.saved_rule }) : '') }])
    if (d.saved_rule) loadRules()
  }
  const addRule = async () => {
    const rule = newRule.trim(); if (!rule) return
    const res = await fetch('/api/audit/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rule, store: ruleScope === 'store' ? store : '' }) })
    if (res.ok) { setNewRule(''); loadRules() }
  }
  const toggleRule = async (r: Rule) => { await fetch('/api/audit/rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, active: !r.active }) }); loadRules() }
  const delRule = async (id: string) => { await fetch('/api/audit/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadRules() }

  return (
    <div className="grid md:grid-cols-[1fr_20rem] gap-4">
      <Card className="p-4 flex flex-col" style={{ height: '30rem' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm font-medium">{t('discussWithAi', { store: store || '—', year, month })}</div>
          <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => { setChatId(''); setMsgs([]) }}><Plus className="h-4 w-4" />{t('newDiscussion')}</Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {msgs.length === 0 && <p className="text-xs text-gray-400 py-8 text-center">{t('chatEmptyHint')}</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-gray-100 mr-8'}`}>{m.content}</div>
          ))}
          {sending && <div className="text-sm bg-gray-100 mr-8 rounded-lg px-3 py-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('thinking')}</div>}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={t('inputMessagePlaceholder')} className="h-9" disabled={sending} />
          <Button size="sm" onClick={send} disabled={sending || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1.5"><ScrollText className="h-4 w-4 text-primary" />{t('hardRules')}</div>
        <p className="text-[11px] text-gray-400">{t('hardRulesDesc')}</p>
        <div className="space-y-1.5">
          <Input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder={t('newRulePlaceholder')} className="h-8" />
          <div className="flex items-center gap-2">
            <select value={ruleScope} onChange={e => setRuleScope(e.target.value as 'store' | 'all')} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="store">{t('limitToStore', { store: store || t('thisStore') })}</option><option value="all">{t('allStores')}</option>
            </select>
            <Button size="sm" className="gap-1 h-8" onClick={addRule} disabled={!newRule.trim()}><Plus className="h-3.5 w-3.5" />{t('add')}</Button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {rules.length === 0 ? <p className="text-xs text-gray-400">{t('noRules')}</p> : rules.map(r => (
            <div key={r.id} className={`text-xs border rounded-lg px-2 py-1.5 flex items-start gap-2 ${r.active ? '' : 'opacity-50'}`}>
              <button onClick={() => toggleRule(r)} title={r.active ? t('disable') : t('enable')} className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${r.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className="flex-1">{r.rule}{r.store ? <span className="text-gray-400">{t('limitedToStoreSuffix', { store: r.store })}</span> : <span className="text-gray-400">{t('allStoresSuffix')}</span>}</span>
              <button onClick={() => delRule(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations('Audit')
  const [cfg, setCfg] = useState({ variance_threshold: 10, cup_code: '', tea_code: '', creamer_code: '', tea_per_cup: 0, creamer_per_cup: 0 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/inv/settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(c => ({ ...c, ...d })) }) }, [])
  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false); setMsg(res.ok ? t('saved') : t('saveFailed')); if (res.ok) onSaved()
  }
  const F = (k: keyof typeof cfg, label: string, num = false) => (
    <label className="space-y-1"><span className="block text-[11px] text-gray-500">{label}</span>
      <Input value={String(cfg[k])} type={num ? 'number' : 'text'} onChange={e => setCfg({ ...cfg, [k]: num ? (Number(e.target.value) || 0) : e.target.value })} className="h-8" /></label>
  )
  return (
    <Card className="p-4 space-y-2">
      <div className="text-sm font-medium">{t('analysisSettings')}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {F('variance_threshold', t('varianceThreshold'), true)}
        {F('cup_code', t('cupCode'))}
        {F('tea_code', t('teaCode'))}
        {F('creamer_code', t('creamerCode'))}
        {F('tea_per_cup', t('teaPerCup'), true)}
        {F('creamer_per_cup', t('creamerPerCup'), true)}
      </div>
      <div className="flex items-center gap-2"><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveSettings')}</Button>{msg && <span className="text-sm text-gray-500">{msg}</span>}</div>
    </Card>
  )
}

function SalesTab({ store, year, month }: { store: string; year: number; month: number }) {
  const t = useTranslations('Audit')
  const locale = useLocale()
  const [rows, setRows] = useState<{ product_code: string; product_name: string; qty: number; revenue: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true)
    fetch(`/api/audit/data?kind=sales&store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/pos', () => ({ store, year: String(year), month: String(month) }), () => setTick(x => x + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xls,.xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">{t('iposDesc')}</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t('uploadIpos')}</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={[t('productCode'), t('productName'), t('qty'), t('amount')]}
        rows={rows.map(r => [r.product_code, r.product_name, fmt(r.qty, locale), fmt(r.revenue, locale)])} numCols={[2, 3]} />
    </div>
  )
}

function BalanceTab({ store, year, month }: { store: string; year: number; month: number }) {
  const t = useTranslations('Audit')
  const locale = useLocale()
  const [rows, setRows] = useState<{ material_code: string; material_name: string; unit: string; open_qty: number; in_total: number; out_total: number; close_qty: number; usage_month: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true)
    fetch(`/api/audit/data?kind=balance&store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/inventory', () => ({ store, year: String(year), month: String(month) }), () => setTick(x => x + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">{t('ivtDesc')}</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t('uploadIvt')}</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={[t('materialCode'), t('productName'), t('unit'), t('openQty'), t('inQty'), t('outQty'), t('closeQty'), t('usageMonth')]}
        rows={rows.map(r => [r.material_code, r.material_name, r.unit, fmt(r.open_qty, locale), fmt(r.in_total, locale), fmt(r.out_total, locale), fmt(r.close_qty, locale), fmt(r.usage_month, locale)])} numCols={[3, 4, 5, 6, 7]} />
    </div>
  )
}

function PricesTab() {
  const t = useTranslations('Audit')
  const locale = useLocale()
  const [rows, setRows] = useState<{ material_code: string; material_name: string; unit: string; export_price: number; purchase_price: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/audit/data?kind=prices').then(r => r.ok ? r.json() : { rows: [] }).then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/prices', () => ({}), () => setTick(x => x + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">{t('centralKitchenPriceDesc')}</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t('uploadStandardPrice')}</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={[t('materialCode'), t('productName'), t('unit'), t('exportPrice'), t('purchasePrice')]}
        rows={rows.map(r => [r.material_code, r.material_name, r.unit, fmt(r.export_price, locale), fmt(r.purchase_price, locale)])} numCols={[3, 4]} />
    </div>
  )
}

function RecipesTab() {
  const t = useTranslations('Audit')
  const [rows, setRows] = useState<{ id: string; name: string; note: string }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/inv/recipes').then(r => r.ok ? r.json() : null).then(d => { setRows(d?.recipes ?? d?.materials ?? []); setLoading(false) })
  }, [])
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500">{t('recipesReadOnlyDesc')}</p>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">{t('noRecipes')}</div>
        : <Card className="p-4"><div className="text-sm text-gray-600">{t('recipeCount', { n: rows.length })}</div></Card>}
    </div>
  )
}

function Table({ loading, empty, head, rows, numCols }: { loading: boolean; empty: boolean; head: string[]; rows: (string | number)[][]; numCols: number[] }) {
  const t = useTranslations('Audit')
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (empty) return <div className="text-center py-8 text-gray-400 text-sm">{t('tableEmpty')}</div>
  const numSet = new Set(numCols)
  return (
    <Card className="p-4">
      <div className="overflow-x-auto max-h-[28rem]">
        <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white">{head.map((h, i) => <th key={i} className={`py-2 pr-2 ${numSet.has(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">{r.map((c, ci) => <td key={ci} className={`py-1 pr-2 ${numSet.has(ci) ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>
          ))}</tbody></table>
      </div>
    </Card>
  )
}
