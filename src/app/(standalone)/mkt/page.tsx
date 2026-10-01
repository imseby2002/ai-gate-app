'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2, AlertCircle, Megaphone, CalendarDays, Plus, Trash2, Pencil,
  X, Save, Sparkles, Check, RotateCcw, CalendarPlus, MapPin, Bike, Star, ExternalLink,
  BarChart3, Building2, Globe,
  CheckCircle2, Search, Tag, Eye, BookOpen, Users, Rocket
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CampaignsTab } from '@/components/marketing/CampaignsTab'
import { CrmTab } from '@/components/marketing/CrmTab'
import { CompanyProfileEditor, type CompanyProfileTab } from '@/components/company/CompanyProfileEditor'

const selCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'
const ta = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm'
type Tab = 'company' | 'generate' | 'campaigns' | 'crm' | 'delivery' | 'analytics' | 'calendar' | 'offline'

export default function MktPage() {
  const t = useTranslations('MktPage')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('company')
  const [companyTab, setCompanyTab] = useState<CompanyProfileTab>('basic')

  useEffect(() => {
    fetch('/api/mkt/brand').then(r => {
      setAllowed(r.status !== 403)
      // 支援 /mkt?tab=products 等直接開啟公司資料指定分頁
      const q = new URLSearchParams(window.location.search).get('tab')
      if (q && ['basic', 'brand', 'stores', 'products', 'files'].includes(q)) { setTab('company'); setCompanyTab(q as CompanyProfileTab) }
      else if (q && ['generate', 'campaigns', 'crm', 'delivery', 'analytics', 'calendar', 'offline'].includes(q)) setTab(q as Tab)
    })
  }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('forbidden')}</p></div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com/marketing/templates' : '/marketing/templates'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 text-white hover:opacity-95 transition-opacity shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            視覺風格與廣告 <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com' : '/marketing'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('openMarketingCenter')} <ExternalLink className="h-3 w-3" />
          </a>
          <Link href="/marketing/logbook"><Button variant="outline" size="sm" className="gap-1.5"><BookOpen className="h-4 w-4" />{t('marketingLog')}</Button></Link>
        </div>
      </div>

      {/* 提示連結卡片 */}
      <div className="p-3.5 bg-gradient-to-r from-pink-50/80 via-purple-50/60 to-blue-50/60 dark:from-pink-950/30 dark:via-purple-950/20 dark:to-blue-950/20 border border-pink-200/70 dark:border-pink-800/40 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-600 shrink-0" />
          <span className="text-slate-700 dark:text-slate-200">
            {t.rich('marketingSubdomainHint', { code: (chunks) => <code className="font-mono bg-white dark:bg-black/30 px-1.5 py-0.5 rounded text-pink-600 font-bold">{chunks}</code> })}
          </span>
        </div>
        <a
          href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com' : '/marketing'}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-pink-700 dark:text-pink-300 hover:underline inline-flex items-center gap-1"
        >
          {t('goToMarketingCenter')}
        </a>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit flex-wrap">
        {([
          ['company', '公司資料', <Building2 key="c0" className="h-4 w-4" />],
          ['generate', t('tabGenerate'), <Sparkles key="g" className="h-4 w-4" />],
          ['campaigns', '活動企劃中心 (AI/成效)', <Sparkles key="cp" className="h-4 w-4 text-purple-500" />],
          ['offline', t('tabOffline'), <MapPin key="o" className="h-4 w-4" />],
          ['crm', '會員 CRM & VIP', <Users key="crm" className="h-4 w-4" />],
          ['delivery', t('tabDelivery'), <Bike key="d" className="h-4 w-4" />],
          ['analytics', t('tabAnalytics'), <BarChart3 key="a" className="h-4 w-4" />],
          ['calendar', t('tabCalendar'), <CalendarDays key="c" className="h-4 w-4" />]
        ] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{label}</button>
        ))}
      </div>

      {tab === 'company' ? <CompanyProfileEditor key={companyTab} initialTab={companyTab} />
        : tab === 'generate' ? <GenerateTab />
        : tab === 'campaigns' ? <CampaignsTab />
        : tab === 'offline' ? <OfflineTab />
        : tab === 'crm' ? <CrmTab />
        : tab === 'delivery' ? <DeliveryTab />
        : tab === 'analytics' ? <AnalyticsTab />
        : <CalendarTab />}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>{hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

// ─────────────────────── 一鍵產出 ───────────────────────
const GEN_CHANNELS: [string, string][] = [['fb', 'Facebook'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['zalo', 'Zalo'], ['line', 'LINE']]
const CONTENT_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'default' | 'secondary' | 'destructive'> = { review: 'warning', approved: 'success', scheduled: 'default', published: 'success', rejected: 'destructive' }
interface ContentRow { id: string; topic: string; channels: string[]; status: string; created_at: string }
interface ContentFull { id: string; topic: string; brief: string; channels: string[]; outputs: Record<string, any>; status: string; review_note: string }

function GenerateTab() {
  const t = useTranslations('MktPage')
  const CONTENT_STATUS_LABEL: Record<string, string> = { review: t('statusReview'), approved: t('statusApproved'), scheduled: t('statusScheduled'), published: t('statusPublished'), rejected: t('statusRejected') }
  const [list, setList] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [brief, setBrief] = useState('')
  const [channels, setChannels] = useState<string[]>(['fb', 'ig'])
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [detailId, setDetailId] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/mkt/content')
    const j = await r.json().catch(() => ({}))
    setList(j.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { loadList() }, [loadList])

  async function generate() {
    if (!topic.trim()) { setErr(t('topicRequired')); return }
    setGenerating(true); setErr('')
    const r = await fetch('/api/mkt/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, brief, channels }) })
    const j = await r.json().catch(() => ({})); setGenerating(false)
    if (!r.ok) { setErr(j.error || t('generateFailed')); return }
    setTopic(''); setBrief('')
    await loadList()
    setDetailId(j.id)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />{t('oneClickGenerateTitle')}</div>
        <p className="text-xs text-muted-foreground">{t('oneClickGenerateDesc')}</p>
        <Field label={t('topicLabel')}><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder={t('topicPlaceholder')} /></Field>
        <Field label={t('briefLabel')} hint={t('briefHint')}><textarea rows={2} className={ta} value={brief} onChange={e => setBrief(e.target.value)} /></Field>
        <div>
          <div className="text-sm font-medium mb-1.5">{t('outputChannelsLabel')}</div>
          <div className="flex flex-wrap gap-2">
            {GEN_CHANNELS.map(([k, label]) => {
              const on = channels.includes(k)
              return (
                <button key={k} type="button" onClick={() => setChannels(on ? channels.filter(x => x !== k) : [...channels, k])}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground hover:border-primary/50'}`}>{label}</button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={generate} disabled={generating} className="gap-1.5">{generating ? <><Loader2 className="h-4 w-4 animate-spin" />{t('generating')}</> : <><Sparkles className="h-4 w-4" />{t('aiGenerateAll')}</>}</Button>
          {err && <span className="text-sm text-red-500">{err}</span>}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : list.length === 0 ? <div className="text-center py-10 text-muted-foreground text-sm">{t('noContentYet')}</div>
        : (
          <div className="space-y-2">
            {list.map(i => (
              <button key={i.id} onClick={() => setDetailId(i.id)} className="w-full text-left flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{i.topic}</span>
                    <Badge variant={CONTENT_STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{CONTENT_STATUS_LABEL[i.status] ?? i.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{(i.channels ?? []).map(c => (GEN_CHANNELS.find(g => g[0] === c)?.[1] ?? c)).join('、')}　{i.created_at?.slice(0, 10)}</div>
                </div>
              </button>
            ))}
          </div>
        )}

      {detailId && <ContentDetail id={detailId} onClose={() => setDetailId('')} onChanged={loadList} />}
    </div>
  )
}

function ContentDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('MktPage')
  const CONTENT_STATUS_LABEL: Record<string, string> = { review: t('statusReview'), approved: t('statusApproved'), scheduled: t('statusScheduled'), published: t('statusPublished'), rejected: t('statusRejected') }
  const [item, setItem] = useState<ContentFull | null>(null)
  const [outputs, setOutputs] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/mkt/content?id=' + id).then(async r => {
      const j = await r.json().catch(() => ({}))
      if (j.item) { setItem(j.item); setOutputs(j.item.outputs ?? {}) }
    })
  }, [id])

  async function patch(body: Record<string, unknown>, tag: string) {
    setSaving(tag); setMsg('')
    const r = await fetch('/api/mkt/content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    setSaving('')
    if (r.ok) { setMsg(t('updated')); onChanged() } else setMsg(t('failed'))
  }
  async function addToCalendar() {
    if (!item) return
    setSaving('cal')
    await fetch('/api/mkt/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.topic, channel: item.channels?.[0] ?? 'other', status: 'scheduled', note: t('approvedFromGenerate') }) })
    setSaving(''); setMsg(t('addedToCalendar'))
  }

  const setCh = (ch: string, field: string, v: string) => setOutputs(o => ({ ...o, [ch]: { ...(o[ch] ?? {}), [field]: v } }))
  const setGeo = (field: string, v: string) => setOutputs(o => ({ ...o, geo_article: { ...(o.geo_article ?? {}), [field]: v } }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-card p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {!item ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">{item.topic}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={CONTENT_STATUS_VARIANT[item.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{CONTENT_STATUS_LABEL[item.status] ?? item.status}</Badge>
            <span className="text-xs text-muted-foreground">{t('publishAfterReview')}</span>
          </div>

          {outputs._raw ? (
            <textarea rows={16} className={ta} value={outputs._raw} onChange={e => setOutputs({ _raw: e.target.value })} />
          ) : (
            <div className="space-y-4">
              {(item.channels ?? []).filter(c => outputs[c]).map(c => (
                <div key={c} className="space-y-1.5">
                  <div className="text-sm font-semibold">{GEN_CHANNELS.find(g => g[0] === c)?.[1] ?? c}</div>
                  <textarea rows={4} className={ta} value={outputs[c]?.copy ?? ''} onChange={e => setCh(c, 'copy', e.target.value)} />
                  <Input value={Array.isArray(outputs[c]?.hashtags) ? outputs[c].hashtags.join(' ') : (outputs[c]?.hashtags ?? '')}
                    onChange={e => setOutputs(o => ({ ...o, [c]: { ...(o[c] ?? {}), hashtags: e.target.value.split(/\s+/).filter(Boolean) } }))}
                    placeholder="hashtags" />
                </div>
              ))}
              {outputs.video_script !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">{t('videoScriptLabel')}</div>
                  <textarea rows={5} className={ta} value={outputs.video_script ?? ''} onChange={e => setOutputs(o => ({ ...o, video_script: e.target.value }))} /></div>
              )}
              {outputs.image_prompt !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">{t('imagePromptLabel')}</div>
                  <textarea rows={2} className={ta} value={outputs.image_prompt ?? ''} onChange={e => setOutputs(o => ({ ...o, image_prompt: e.target.value }))} /></div>
              )}
              {outputs.geo_article !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">{t('geoArticleLabel')}</div>
                  <Input value={outputs.geo_article?.title ?? ''} onChange={e => setGeo('title', e.target.value)} placeholder={t('titleLabel')} />
                  <textarea rows={8} className={ta} value={outputs.geo_article?.body ?? ''} onChange={e => setGeo('body', e.target.value)} /></div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => patch({ outputs }, 'save')} disabled={!!saving} className="gap-1.5">{saving === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('saveChanges')}</Button>
            <Button size="sm" onClick={() => patch({ status: 'approved' }, 'ap')} disabled={!!saving} className="gap-1.5"><Check className="h-4 w-4" />{t('approve')}</Button>
            <Button variant="outline" size="sm" onClick={() => patch({ status: 'rejected' }, 'rj')} disabled={!!saving} className="gap-1.5"><RotateCcw className="h-4 w-4" />{t('reject')}</Button>
            <Button variant="outline" size="sm" onClick={addToCalendar} disabled={!!saving} className="gap-1.5"><CalendarPlus className="h-4 w-4" />{t('addToCalendar')}</Button>
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
          </div>
        </>}
      </div>
    </div>
  )
}

// ─────────────────────── 實體行銷 ───────────────────────
const OFFLINE_TYPE_IDS = ['material', 'event', 'outdoor', 'partner'] as const
const getOfflineTypeLabel = (t: (key: string) => string): Record<string, string> =>
  Object.fromEntries(OFFLINE_TYPE_IDS.map(id => [id, t(`offlineType_${id}`)]))
interface Offline {
  id: string; type: string; title: string; store: string; status: string
  start_date: string | null; end_date: string | null; budget: number; counterparty: string; photo_url: string; note: string
}
const fmtNum = (n: number, locale: string) => Math.round(n).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const blankOffline = (type: string): Partial<Offline> => ({ type, title: '', store: '', status: 'planned', start_date: '', end_date: '', budget: 0, counterparty: '', photo_url: '', note: '' })

function OfflineTab() {
  const t = useTranslations('MktPage')
  const locale = useLocale()
  const OFFLINE_TYPE_LABEL = getOfflineTypeLabel(t)
  const OFFLINE_TYPE: [string, string][] = OFFLINE_TYPE_IDS.map(id => [id, OFFLINE_TYPE_LABEL[id]])
  const OFFLINE_STATUS_LABEL: Record<string, string> = { planned: t('offlineStatus_planned'), active: t('offlineStatus_active'), installed: t('offlineStatus_installed'), done: t('offlineStatus_done'), cancelled: t('offlineStatus_cancelled') }
  const OFFLINE_STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'success' | 'warning'> = { planned: 'secondary', active: 'warning', installed: 'default', done: 'success', cancelled: 'secondary' }
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<Offline[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Offline> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams(); if (type) sp.set('type', type); if (status) sp.set('status', status)
    const r = await fetch('/api/mkt/offline?' + sp.toString())
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [type, status])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!String(editing.title ?? '').trim()) { setErr(t('titleRequired')); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/offline', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || t('saveFailed')); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm(t('confirmDelete'))) return
    await fetch('/api/mkt/offline', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('offlineTabDesc')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className={selCls}>
          <option value="">{t('allTypes')}</option>
          {OFFLINE_TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">{t('allStatuses')}</option>
          {Object.entries(OFFLINE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blankOffline(type || 'material')) }}><Plus className="h-4 w-4" />{t('add')}</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">{t('noOfflineItems')}</div>
        : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(i => (
              <div key={i.id} className="rounded-xl border bg-card overflow-hidden">
                {i.photo_url && <img src={i.photo_url} alt="" className="w-full h-32 object-cover" />}
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{OFFLINE_TYPE_LABEL[i.type] ?? i.type}</Badge>
                    <Badge variant={OFFLINE_STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{OFFLINE_STATUS_LABEL[i.status] ?? i.status}</Badge>
                    <span className="font-medium">{i.title}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground space-x-2">
                    {i.store && <span>{t('storeColonLabel')}{i.store}</span>}
                    {i.counterparty && <span>· {i.counterparty}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground space-x-2">
                    {(i.start_date || i.end_date) && <span>{i.start_date ?? ''}{i.end_date ? `～${i.end_date}` : ''}</span>}
                    {i.budget > 0 && <span>· {t('budgetLabel')} {fmtNum(i.budget, locale)}</span>}
                  </div>
                  {i.note && <p className="mt-1 text-sm">{i.note}</p>}
                  <div className="mt-2 flex justify-end gap-1">
                    <button onClick={() => { setErr(''); setEditing({ ...i, start_date: i.start_date ?? '', end_date: i.end_date ?? '' }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? t('editOfflineTitle') : t('addOfflineTitle')}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('typeLabel')}>
                <select value={editing.type ?? 'material'} onChange={e => setEditing({ ...editing, type: e.target.value })} className={`w-full ${selCls}`}>
                  {OFFLINE_TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label={t('statusLabel')}>
                <select value={editing.status ?? 'planned'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                  {Object.entries(OFFLINE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <div className="col-span-2"><Field label={t('offlineTitleLabel')}><Input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder={t('offlineTitlePlaceholder')} /></Field></div>
              <Field label={t('storeLabel')}><Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} placeholder={t('storeEmptyMeansAll')} /></Field>
              <Field label={t('counterpartyLabel')}><Input value={editing.counterparty ?? ''} onChange={e => setEditing({ ...editing, counterparty: e.target.value })} /></Field>
              <Field label={t('startDateLabel')}><Input type="date" value={editing.start_date ?? ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} /></Field>
              <Field label={t('endDateLabel')}><Input type="date" value={editing.end_date ?? ''} onChange={e => setEditing({ ...editing, end_date: e.target.value })} /></Field>
              <Field label={t('budgetCostLabel')}><Input type="number" value={String(editing.budget ?? 0)} onChange={e => setEditing({ ...editing, budget: Number(e.target.value) || 0 })} /></Field>
              <Field label={t('photoUrlLabel')} hint={t('photoUrlHint')}><Input value={editing.photo_url ?? ''} onChange={e => setEditing({ ...editing, photo_url: e.target.value })} placeholder="https://" /></Field>
              <div className="col-span-2"><Field label={t('noteLabel')}><textarea rows={2} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field></div>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 外送平台 ───────────────────────
const DELIVERY_PLATFORM_IDS = ['grab', 'shopee', 'baemin', 'other'] as const
const getDeliveryPlatformLabel = (t: (key: string) => string): Record<string, string> =>
  Object.fromEntries(DELIVERY_PLATFORM_IDS.map(id => [id, id === 'other' ? t('deliveryPlatform_other') : id === 'grab' ? 'GrabFood' : id === 'shopee' ? 'ShopeeFood' : 'Baemin']))
interface Delivery {
  id: string; platform: string; store: string; status: string; url: string
  commission_rate: number; rating: number; ranking: number | null; period: string
  monthly_orders: number; monthly_revenue: number; promo: string; note: string
}
const blankDelivery = (platform: string): Partial<Delivery> => ({ platform: platform || 'grab', store: '', status: 'online', url: '', commission_rate: 0, rating: 0, ranking: null, period: '', monthly_orders: 0, monthly_revenue: 0, promo: '', note: '' })

function DeliveryTab() {
  const t = useTranslations('MktPage')
  const locale = useLocale()
  const DELIVERY_PLATFORM_LABEL = getDeliveryPlatformLabel(t)
  const DELIVERY_PLATFORM: [string, string][] = DELIVERY_PLATFORM_IDS.map(id => [id, DELIVERY_PLATFORM_LABEL[id]])
  const DELIVERY_STATUS_LABEL: Record<string, string> = { online: t('deliveryStatus_online'), offline: t('deliveryStatus_offline'), pending: t('deliveryStatus_pending'), suspended: t('deliveryStatus_suspended') }
  const DELIVERY_STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'warning' | 'destructive'> = { online: 'success', offline: 'secondary', pending: 'warning', suspended: 'destructive' }
  const [platform, setPlatform] = useState('')
  const [items, setItems] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Delivery> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams(); if (platform) sp.set('platform', platform)
    const r = await fetch('/api/mkt/delivery?' + sp.toString())
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [platform])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!String(editing.store ?? '').trim()) { setErr(t('storeRequired')); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/delivery', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || t('saveFailed')); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm(t('confirmDelete'))) return
    await fetch('/api/mkt/delivery', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const online = items.filter(i => i.status === 'online').length
  const totalOrders = items.reduce((sum, i) => sum + (i.monthly_orders || 0), 0)
  const totalRevenue = items.reduce((sum, i) => sum + (i.monthly_revenue || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('onlineLabel')}</div><div className="mt-1 text-xl font-bold">{online}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('monthlyOrdersLabel')}</div><div className="mt-1 text-xl font-bold">{fmtNum(totalOrders, locale)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('monthlyRevenueLabel')}</div><div className="mt-1 text-xl font-bold">{fmtNum(totalRevenue, locale)}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className={selCls}>
          <option value="">{t('allPlatforms')}</option>
          {DELIVERY_PLATFORM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blankDelivery(platform || 'grab')) }}><Plus className="h-4 w-4" />{t('addListing')}</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">{t('noDeliveryData')}</div>
        : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(i => (
              <div key={i.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{DELIVERY_PLATFORM_LABEL[i.platform] ?? i.platform}</Badge>
                  <Badge variant={DELIVERY_STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{DELIVERY_STATUS_LABEL[i.status] ?? i.status}</Badge>
                  <span className="font-medium">{i.store}</span>
                  {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                  {i.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{i.rating}{i.ranking ? t('rankingSuffix', { n: i.ranking }) : ''}</span>}
                  {i.commission_rate > 0 && <span className="text-muted-foreground">{t('commissionLabel', { n: i.commission_rate })}</span>}
                  {i.monthly_orders > 0 && <span className="text-muted-foreground">{t('ordersLabel')} {fmtNum(i.monthly_orders, locale)}</span>}
                  {i.monthly_revenue > 0 && <span className="text-muted-foreground">{t('revenueLabel')} {fmtNum(i.monthly_revenue, locale)}</span>}
                </div>
                {i.promo && <p className="mt-1 text-sm text-emerald-600">{t('promoLabel')}{i.promo}</p>}
                {i.note && <p className="mt-1 text-sm text-muted-foreground">{i.note}</p>}
                <div className="mt-2 flex justify-end gap-1">
                  <button onClick={() => { setErr(''); setEditing({ ...i }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? t('editDeliveryTitle') : t('addDeliveryTitle')}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('platformLabel')}>
                <select value={editing.platform ?? 'grab'} onChange={e => setEditing({ ...editing, platform: e.target.value })} className={`w-full ${selCls}`}>
                  {DELIVERY_PLATFORM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label={t('statusLabel')}>
                <select value={editing.status ?? 'online'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                  {Object.entries(DELIVERY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label={t('storeRequiredLabel')}><Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} /></Field>
              <Field label={t('storeLinkLabel')}><Input value={editing.url ?? ''} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://" /></Field>
              <Field label={t('commissionRateLabel')}><Input type="number" value={String(editing.commission_rate ?? 0)} onChange={e => setEditing({ ...editing, commission_rate: Number(e.target.value) || 0 })} /></Field>
              <Field label={t('ratingLabel')}><Input type="number" value={String(editing.rating ?? 0)} onChange={e => setEditing({ ...editing, rating: Number(e.target.value) || 0 })} /></Field>
              <Field label={t('rankingLabel')}><Input type="number" value={editing.ranking == null ? '' : String(editing.ranking)} onChange={e => setEditing({ ...editing, ranking: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label={t('periodLabel')}><Input value={editing.period ?? ''} onChange={e => setEditing({ ...editing, period: e.target.value })} placeholder="2026-09" /></Field>
              <Field label={t('monthlyOrdersInputLabel')}><Input type="number" value={String(editing.monthly_orders ?? 0)} onChange={e => setEditing({ ...editing, monthly_orders: Number(e.target.value) || 0 })} /></Field>
              <Field label={t('monthlyRevenueInputLabel')}><Input type="number" value={String(editing.monthly_revenue ?? 0)} onChange={e => setEditing({ ...editing, monthly_revenue: Number(e.target.value) || 0 })} /></Field>
              <div className="col-span-2"><Field label={t('activePromoLabel')}><Input value={editing.promo ?? ''} onChange={e => setEditing({ ...editing, promo: e.target.value })} placeholder={t('activePromoPlaceholder')} /></Field></div>
              <div className="col-span-2"><Field label={t('noteLabel')}><textarea rows={2} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field></div>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 成效分析 ───────────────────────
interface MktSnap {
  delivery: { byPlatform: { platform: string; orders: number; revenue: number; count: number; online: number }[]; totalOrders: number; totalRevenue: number }
  offline: { spend: number; active: number; byType: { type: string; count: number; spend: number }[] }
  content: { total: number; review: number; published: number }
  pnl: { period: string; revenue: number; advertising: number } | null
  spend_total: number; delivery_share: number | null
}

function AnalyticsTab() {
  const t = useTranslations('MktPage')
  const locale = useLocale()
  const OFFLINE_TYPE_LABEL = getOfflineTypeLabel(t)
  const DELIVERY_PLATFORM_LABEL = getDeliveryPlatformLabel(t)
  const [snap, setSnap] = useState<MktSnap | null>(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState('')
  const [gen, setGen] = useState('')

  useEffect(() => { fetch('/api/mkt/analytics').then(async r => { if (r.ok) setSnap(await r.json().catch(() => null)); setLoading(false) }) }, [])

  async function genReport(kind: 'weekly' | 'monthly') {
    setGen(kind); setReport('')
    const r = await fetch('/api/mkt/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
    const j = await r.json().catch(() => ({})); setGen('')
    setReport(j.report || j.error || t('generateReportFailed'))
  }

  if (loading || !snap) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('deliveryMonthlyRevenueLabel')}</div><div className="mt-1 text-xl font-bold">{fmtNum(snap.delivery.totalRevenue, locale)}</div><div className="text-xs text-muted-foreground">{t('ordersLabel')} {fmtNum(snap.delivery.totalOrders, locale)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('totalMarketingSpendLabel')}</div><div className="mt-1 text-xl font-bold">{fmtNum(snap.spend_total, locale)}</div><div className="text-xs text-muted-foreground">{t('offlineSpendLabel')} {fmtNum(snap.offline.spend, locale)}＋{t('advertisingLabel')} {fmtNum(snap.pnl?.advertising ?? 0, locale)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('deliveryShareLabel')}</div><div className="mt-1 text-xl font-bold">{snap.delivery_share != null ? (snap.delivery_share * 100).toFixed(1) + '%' : '—'}</div><div className="text-xs text-muted-foreground">{snap.pnl ? t('pnlPeriodLabel', { period: snap.pnl.period }) : t('noPnlData')}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{t('contentOutputLabel')}</div><div className="mt-1 text-xl font-bold">{snap.content.total}</div><div className="text-xs text-muted-foreground">{t('pendingReviewLabel', { n: snap.content.review })}・{t('publishedLabel', { n: snap.content.published })}</div></div>
      </div>

      {snap.delivery.byPlatform.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">{t('deliveryPlatformPerformance')}</h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50 text-left text-muted-foreground"><th className="px-3 py-2 font-medium">{t('platformLabel')}</th><th className="px-3 py-2 font-medium text-right">{t('listedLabel')}</th><th className="px-3 py-2 font-medium text-right">{t('ordersLabel')}</th><th className="px-3 py-2 font-medium text-right">{t('revenueLabel')}</th></tr></thead>
              <tbody>
                {snap.delivery.byPlatform.map(p => (
                  <tr key={p.platform} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{DELIVERY_PLATFORM_LABEL[p.platform] ?? p.platform}</td>
                    <td className="px-3 py-2 text-right">{p.online}/{p.count}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(p.orders, locale)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(p.revenue, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snap.offline.byType.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">{t('offlineSpendTitle')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {snap.offline.byType.map(ot => (
              <div key={ot.type} className="rounded-lg border bg-card px-3 py-2">
                <div className="text-xs text-muted-foreground">{OFFLINE_TYPE_LABEL[ot.type] ?? ot.type}</div>
                <div className="mt-0.5 font-semibold">{fmtNum(ot.spend, locale)}</div>
                <div className="text-xs text-muted-foreground">{t('itemCountLabel', { n: ot.count })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">{t('aiMarketingReportTitle')}</h2>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => genReport('weekly')} disabled={!!gen}>{gen === 'weekly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{t('weeklyReport')}</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => genReport('monthly')} disabled={!!gen}>{gen === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{t('monthlyReport')}</Button>
          </div>
        </div>
        {report ? <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{report}</div>
          : <p className="text-sm text-muted-foreground">{t('reportHint')}</p>}
      </section>
    </div>
  )
}

// ─────────────────────── 內容行事曆 ───────────────────────
interface Item { id: string; title: string; channel: string; scheduled_date: string | null; status: string; note: string }
const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'default'> = { idea: 'secondary', draft: 'secondary', review: 'warning', scheduled: 'default', published: 'success' }

const blank = (): Partial<Item> => ({ title: '', channel: 'fb', scheduled_date: '', status: 'idea', note: '' })

function CalendarTab() {
  const t = useTranslations('MktPage')
  const CHANNEL_LABEL: Record<string, string> = { fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok', zalo: 'Zalo', line: 'LINE', store: t('channelStore'), other: t('channelOther') }
  const STATUS_LABEL: Record<string, string> = { idea: t('calStatus_idea'), draft: t('calStatus_draft'), review: t('statusReview'), scheduled: t('statusScheduled'), published: t('statusPublished') }
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Partial<Item> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams(); if (status) sp.set('status', status)
    const r = await fetch('/api/mkt/calendar?' + sp.toString())
    const j = await r.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [status])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!String(editing.title ?? '').trim()) { setErr(t('titleRequired')); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/calendar', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || t('saveFailed')); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm(t('confirmDelete'))) return
    await fetch('/api/mkt/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">{t('allStatuses')}</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blank()) }}><Plus className="h-4 w-4" />{t('addContent')}</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">{t('noScheduledContent')}</div>
        : (
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="text-center shrink-0 w-16">
                  <div className="text-xs text-muted-foreground">{i.scheduled_date ? i.scheduled_date.slice(5) : t('unscheduled')}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{i.title}</span>
                    <Badge variant={STATUS_VARIANT[i.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                    <span className="text-xs text-muted-foreground">{CHANNEL_LABEL[i.channel] ?? i.channel}</span>
                  </div>
                  {i.note && <p className="text-sm text-muted-foreground truncate">{i.note}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setErr(''); setEditing({ ...i, scheduled_date: i.scheduled_date ?? '' }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? t('editContentTitle') : t('addContentTitle')}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label={t('offlineTitleLabel')}><Input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('platformLabel')}>
                  <select value={editing.channel ?? 'fb'} onChange={e => setEditing({ ...editing, channel: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t('statusLabel')}>
                  <select value={editing.status ?? 'idea'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t('scheduledDateLabel')}><Input type="date" value={editing.scheduled_date ?? ''} onChange={e => setEditing({ ...editing, scheduled_date: e.target.value })} /></Field>
              </div>
              <Field label={t('noteLabel')}><textarea rows={3} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
