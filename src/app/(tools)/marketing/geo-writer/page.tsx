'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ChevronLeft, Search, Sparkles, Loader2, Copy, Check,
  FileText, Code2, RefreshCw, Gauge, Layers, Crown,
  Radar, CheckCircle2, XCircle, Globe, ExternalLink, Languages, Download,
  Settings, Save, Award, BarChart3, Printer, TrendingDown,
  Wrench, Bot, ScrollText, Gauge as GaugeIcon,
  Library, Plus, Trash2, MapPin, UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'

type Intent = 'info' | 'local' | 'compare' | 'transact'
type VolumeSource = 'measured' | 'estimated' | 'unknown'
interface GeoQuestion {
  id: string; question: string; intent: Intent
  opportunity_score?: number; volume_source?: VolumeSource
}
interface GeoArticle { articleId?: string; title: string; body_md: string; json_ld: unknown }
interface GeoCluster { id: string; title: string; pillar: boolean; questionIds: string[] }
interface TrackResult { id: string; cited: boolean; rank: number | null; sources: string[] }
interface PassageScore { index: number; heading: string | null; excerpt: string; score: number; reasons: string[] }
interface Citability { score: number; passages: PassageScore[]; best: number | null; weakest: number | null }
interface ReportData {
  latestCitedRate: number; ourAppearances: number; totalQuestions: number
  competitors: { domain: string; questions: number; share: number }[]
  dropped: { question: string; lastSeen: string }[]
}
interface BusinessProfile {
  name?: string; type?: string; url?: string; phone?: string
  streetAddress?: string; city?: string; region?: string; country?: string
  latitude?: string; longitude?: string; openingHours?: string; priceRange?: string; sameAs?: string[]
}
interface AuthorProfile { name?: string; jobTitle?: string; bio?: string; url?: string }
interface FactItem { label?: string; text?: string }
interface CrawlerReport { domain: string; robotsFound: boolean; blockedCount: number; crawlers: { bot: string; purpose: string; allowed: boolean }[] }
interface AuditReport { url: string; total: number; schemaTypes: string[]; breakdown: { key: string; label: string; score: number; max: number; note: string }[] }

const SOURCE_DOT: Record<VolumeSource, string> = {
  measured:  'bg-emerald-500',
  estimated: 'bg-amber-500',
  unknown:   'bg-slate-400',
}

const INTENT_STYLES: Record<Intent, string> = {
  info:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  local:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  compare:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  transact: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

export default function GeoWriterPage() {
  const t = useTranslations('Marketing')
  const locale = useLocale()

  const [topic, setTopic] = useState('')
  const [exclusiveFacts, setExclusiveFacts] = useState('')
  const [author, setAuthor] = useState('')
  const [targetDomain, setTargetDomain] = useState('')

  const [projectId, setProjectId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<GeoQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [clusters, setClusters] = useState<GeoCluster[]>([])
  const [activeCluster, setActiveCluster] = useState<string | null>(null)
  const [article, setArticle] = useState<GeoArticle | null>(null)
  const [tracking, setTracking] = useState<TrackResult[]>([])
  const [loadingT, setLoadingT] = useState(false)
  const [autoTrack, setAutoTrack] = useState(false)
  const [citability, setCitability] = useState<Citability | null>(null)
  const [loadingCi, setLoadingCi] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loadingR, setLoadingR] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [loadingP, setLoadingP] = useState(false)
  const [loadingTr, setLoadingTr] = useState(false)

  // 發佈設定（per-user）
  const [showSettings, setShowSettings] = useState(false)
  const [wpBaseUrl, setWpBaseUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpAppPassword, setWpAppPassword] = useState('')
  const [wpConfigured, setWpConfigured] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [webhookConfigured, setWebhookConfigured] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // 素材庫
  const [showMaterial, setShowMaterial] = useState(false)
  const [business, setBusiness] = useState<BusinessProfile>({})
  const [authors, setAuthors] = useState<AuthorProfile[]>([])
  const [facts, setFacts] = useState<FactItem[]>([])
  const [savingMat, setSavingMat] = useState(false)
  const [matSaved, setMatSaved] = useState(false)

  useEffect(() => {
    fetch('/api/marketing/geo/material')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setBusiness(d.business ?? {})
        setAuthors(d.authors ?? [])
        setFacts(d.facts ?? [])
      })
      .catch(() => {})
  }, [])

  async function saveMaterial() {
    setSavingMat(true); setMatSaved(false); setError('')
    try {
      const res = await fetch('/api/marketing/geo/material', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, authors, facts }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'error')
      setMatSaved(true); setTimeout(() => setMatSaved(false), 2000)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setSavingMat(false) }
  }

  function insertFact(f: FactItem) {
    const line = f.text?.trim()
    if (!line) return
    setExclusiveFacts(prev => prev ? `${prev}\n${line}` : line)
  }

  const bz = (k: keyof BusinessProfile, v: string) => setBusiness(b => ({ ...b, [k]: v }))

  // GEO 技術工具
  const [showTools, setShowTools] = useState(false)
  const [crawlerReport, setCrawlerReport] = useState<CrawlerReport | null>(null)
  const [loadingCr, setLoadingCr] = useState(false)
  const [auditInput, setAuditInput] = useState('')
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [loadingAu, setLoadingAu] = useState(false)

  useEffect(() => {
    fetch('/api/marketing/geo/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setWpBaseUrl(d.wpBaseUrl ?? '')
        setWpUser(d.wpUser ?? '')
        setWpConfigured(!!d.wpConfigured)
        setWebhookUrl(d.webhookUrl ?? '')
        setWebhookConfigured(!!d.webhookConfigured)
      })
      .catch(() => {})
  }, [])

  async function saveSettings() {
    setSavingSettings(true); setSettingsSaved(false); setError('')
    try {
      const res = await fetch('/api/marketing/geo/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpBaseUrl, wpUser, wpAppPassword, webhookUrl, webhookToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      if (wpAppPassword.trim()) setWpConfigured(true)
      if (webhookToken.trim()) setWebhookConfigured(true)
      setWpAppPassword(''); setWebhookToken('')
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setSavingSettings(false) }
  }

  async function checkCrawlers() {
    const dom = (targetDomain || auditInput).trim()
    if (!dom) { setError(t('geo.errDomain')); return }
    setError(''); setLoadingCr(true)
    try {
      const res = await fetch(`/api/marketing/geo/crawlers?domain=${encodeURIComponent(dom)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setCrawlerReport(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingCr(false) }
  }

  function downloadLlms() {
    if (!projectId) { setError(t('geo.errTopic')); return }
    window.open(`/api/marketing/geo/llms?projectId=${projectId}`, '_blank')
  }

  async function auditPage() {
    const url = (auditInput || publishedUrl || '').trim()
    if (!url) { setError(t('geo.errUrl')); return }
    setError(''); setLoadingAu(true)
    try {
      const res = await fetch('/api/marketing/geo/audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setAuditReport(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingAu(false) }
  }

  const [loadingQ, setLoadingQ] = useState(false)
  const [loadingS, setLoadingS] = useState(false)
  const [loadingC, setLoadingC] = useState(false)
  const [loadingA, setLoadingA] = useState(false)
  const [scored, setScored] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'md' | 'jsonld' | null>(null)

  async function explore() {
    if (!topic.trim()) { setError(t('geo.errTopic')); return }
    setError(''); setLoadingQ(true); setQuestions([]); setSelected(new Set()); setArticle(null); setProjectId(null); setScored(false); setClusters([]); setActiveCluster(null)
    try {
      const res = await fetch('/api/marketing/geo/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, exclusiveFacts, author, targetDomain, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      const qs: GeoQuestion[] = data.questions ?? []
      setProjectId(data.projectId ?? null)
      setQuestions(qs)
      setSelected(new Set(qs.map((_, i) => i)))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingQ(false) }
  }

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function scoreAll() {
    if (!projectId) return
    setError(''); setLoadingS(true)
    try {
      const res = await fetch('/api/marketing/geo/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      const scoreMap = new Map<string, { opportunity_score: number; volume_source: VolumeSource }>(
        (data.questions ?? []).map((s: { id: string; opportunity_score: number; volume_source: VolumeSource }) =>
          [s.id, { opportunity_score: s.opportunity_score, volume_source: s.volume_source }]),
      )
      setQuestions(prev =>
        [...prev]
          .map(q => {
            const s = scoreMap.get(q.id)
            return s ? { ...q, ...s } : q
          })
          .sort((a, b) => (b.opportunity_score ?? -1) - (a.opportunity_score ?? -1)),
      )
      setSelected(new Set(questions.map((_, i) => i))) // 重排後維持全選；下方依新順序
      setScored(true)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingS(false) }
  }

  async function clusterPlan() {
    if (!projectId) return
    setError(''); setLoadingC(true)
    try {
      const res = await fetch('/api/marketing/geo/cluster', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setClusters(data.clusters ?? [])
      setActiveCluster(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingC(false) }
  }

  function pickCluster(c: GeoCluster) {
    setActiveCluster(c.id)
    const idxs = c.questionIds
      .map(qid => questions.findIndex(q => q.id === qid))
      .filter(i => i >= 0)
    setSelected(new Set(idxs))
  }

  async function generate() {
    const pickedIds = questions.filter((_, i) => selected.has(i)).map(q => q.id)
    if (pickedIds.length === 0) { setError(t('geo.errPick')); return }
    if (!projectId) { setError(t('geo.errTopic')); return }
    setError(''); setLoadingA(true); setArticle(null)
    try {
      const res = await fetch('/api/marketing/geo/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, questionIds: pickedIds, clusterId: activeCluster, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setArticle(data)
      setPublishedUrl(null)
      setTracking([])
      setCitability(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingA(false) }
  }

  async function checkCitability() {
    if (!article?.articleId) return
    setError(''); setLoadingCi(true)
    try {
      const res = await fetch('/api/marketing/geo/citability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setCitability(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingCi(false) }
  }

  async function loadReport() {
    if (!projectId) return
    setError(''); setLoadingR(true)
    try {
      const res = await fetch(`/api/marketing/geo/report?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setReport(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingR(false) }
  }

  function printReport() {
    if (!projectId) return
    window.open(`/api/marketing/geo/report?projectId=${projectId}&format=html`, '_blank')
  }

  async function publish(mode: 'landing' | 'wordpress' | 'webhook' | 'export') {
    if (!article?.articleId) return
    setError(''); setLoadingP(true)
    try {
      const res = await fetch('/api/marketing/geo/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.articleId, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      if (mode === 'export') {
        const blob = new Blob([data.html], { type: 'text/html' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = data.filename || 'geo-article.html'
        a.click()
        URL.revokeObjectURL(a.href)
      } else {
        setPublishedUrl(data.url || null)
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingP(false) }
  }

  async function translate(targetLocale: 'zh-TW' | 'en' | 'vi') {
    if (!article?.articleId) return
    setError(''); setLoadingTr(true)
    try {
      const res = await fetch('/api/marketing/geo/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.articleId, targetLocale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setArticle(data)
      setPublishedUrl(null)
      setTracking([])
      setCitability(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingTr(false) }
  }

  async function trackNow() {
    if (!projectId) return
    setError(''); setLoadingT(true)
    try {
      const res = await fetch('/api/marketing/geo/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setTracking(data.results ?? [])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingT(false) }
  }

  async function toggleAutoTrack() {
    if (!projectId) return
    const next = !autoTrack
    setAutoTrack(next)
    try {
      const res = await fetch('/api/marketing/geo/auto-track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, autoTrack: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setAutoTrack(!next) // 回滾
      setError(t('geo.saveFail'))
    }
  }

  async function copy(kind: 'md' | 'jsonld') {
    if (!article) return
    const text = kind === 'md'
      ? article.body_md
      : typeof article.json_ld === 'string' ? article.json_ld : JSON.stringify(article.json_ld, null, 2)
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

        <div className="flex items-center gap-2">
          <Link href="/marketing" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              {t('geo.title')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('geo.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMaterial(s => !s)}>
            <Library className="h-3.5 w-3.5" /> {t('geo.material')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTools(s => !s)}>
            <Wrench className="h-3.5 w-3.5" /> {t('geo.tools')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(s => !s)}>
            <Settings className="h-3.5 w-3.5" /> {t('geo.publishSettings')}
          </Button>
        </div>

        {/* 素材庫：商家檔案(LocalBusiness) / 作者(Person) / 獨家事實 */}
        {showMaterial && (
          <div className="bg-card rounded-xl border p-5 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Library className="h-4 w-4 text-indigo-600" /> {t('geo.material')}
            </h2>
            <p className="text-[11px] text-muted-foreground">{t('geo.materialHint')}</p>

            {/* 商家檔案 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t('geo.bizSection')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={business.name ?? ''} onChange={e => bz('name', e.target.value)} placeholder={t('geo.bizName')} />
                <select value={business.type ?? 'LocalBusiness'} onChange={e => bz('type', e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {['LocalBusiness', 'TravelAgency', 'Restaurant', 'Store', 'ProfessionalService', 'Organization'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <Input value={business.url ?? ''} onChange={e => bz('url', e.target.value)} placeholder={t('geo.bizUrl')} />
                <Input value={business.phone ?? ''} onChange={e => bz('phone', e.target.value)} placeholder={t('geo.bizPhone')} />
                <Input value={business.streetAddress ?? ''} onChange={e => bz('streetAddress', e.target.value)} placeholder={t('geo.bizStreet')} />
                <Input value={business.city ?? ''} onChange={e => bz('city', e.target.value)} placeholder={t('geo.bizCity')} />
                <Input value={business.region ?? ''} onChange={e => bz('region', e.target.value)} placeholder={t('geo.bizRegion')} />
                <Input value={business.country ?? ''} onChange={e => bz('country', e.target.value)} placeholder={t('geo.bizCountry')} />
                <Input value={business.latitude ?? ''} onChange={e => bz('latitude', e.target.value)} placeholder={t('geo.bizLat')} />
                <Input value={business.longitude ?? ''} onChange={e => bz('longitude', e.target.value)} placeholder={t('geo.bizLng')} />
                <Input value={business.openingHours ?? ''} onChange={e => bz('openingHours', e.target.value)} placeholder={t('geo.bizHours')} />
                <Input value={business.priceRange ?? ''} onChange={e => bz('priceRange', e.target.value)} placeholder={t('geo.bizPrice')} />
              </div>
            </div>

            {/* 作者 */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><UserCircle className="h-3.5 w-3.5" />{t('geo.authorSection')}</p>
                <Button variant="ghost" size="sm" onClick={() => setAuthors(a => [...a, {}])}><Plus className="h-3.5 w-3.5" />{t('geo.addItem')}</Button>
              </div>
              {authors.map((a, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 relative">
                  <Input value={a.name ?? ''} onChange={e => setAuthors(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t('geo.authorName')} />
                  <Input value={a.jobTitle ?? ''} onChange={e => setAuthors(arr => arr.map((x, j) => j === i ? { ...x, jobTitle: e.target.value } : x))} placeholder={t('geo.authorJob')} />
                  <Input value={a.url ?? ''} onChange={e => setAuthors(arr => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder={t('geo.authorUrl')} />
                  <Input value={a.bio ?? ''} onChange={e => setAuthors(arr => arr.map((x, j) => j === i ? { ...x, bio: e.target.value } : x))} placeholder={t('geo.authorBio')} />
                  <button onClick={() => setAuthors(arr => arr.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-card border rounded-full p-0.5 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            {/* 獨家事實 */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t('geo.factSection')}</p>
                <Button variant="ghost" size="sm" onClick={() => setFacts(f => [...f, {}])}><Plus className="h-3.5 w-3.5" />{t('geo.addItem')}</Button>
              </div>
              {facts.map((f, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input value={f.label ?? ''} onChange={e => setFacts(arr => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder={t('geo.factLabel')} className="w-32 shrink-0" />
                  <Textarea value={f.text ?? ''} onChange={e => setFacts(arr => arr.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder={t('geo.factText')} rows={1} className="flex-1" />
                  <button onClick={() => setFacts(arr => arr.filter((_, j) => j !== i))} className="mt-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            <Button onClick={saveMaterial} disabled={savingMat} size="sm">
              {savingMat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : matSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {matSaved ? t('geo.saved') : t('geo.save')}
            </Button>
          </div>
        )}

        {/* GEO 技術工具：AI 爬蟲檢查 / llms.txt / 落地頁審計 */}
        {showTools && (
          <div className="bg-card rounded-xl border p-5 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-indigo-600" /> {t('geo.tools')}
            </h2>

            {/* AI 爬蟲檢查 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5" /> {t('geo.crawlerTitle')}
                </span>
                <Button variant="outline" size="sm" onClick={checkCrawlers} disabled={loadingCr}>
                  {loadingCr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  {t('geo.crawlerCheck')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t('geo.crawlerHint')}</p>
              {crawlerReport && (
                <div>
                  {!crawlerReport.robotsFound && (
                    <p className="text-[11px] text-amber-600 mb-1">{t('geo.noRobots')}</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {crawlerReport.crawlers.map(c => (
                      <div key={c.bot} className="flex items-center gap-1.5 text-xs">
                        {c.allowed
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span className="truncate" title={c.purpose}>{c.bot}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* llms.txt */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ScrollText className="h-3.5 w-3.5" /> {t('geo.llmsTitle')}
                </span>
                <Button variant="outline" size="sm" onClick={downloadLlms}>
                  <Download className="h-3.5 w-3.5" /> {t('geo.llmsGen')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t('geo.llmsHint')}</p>
            </div>

            {/* 落地頁審計 */}
            <div className="space-y-2 border-t pt-4">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <GaugeIcon className="h-3.5 w-3.5" /> {t('geo.auditTitle')}
              </span>
              <div className="flex gap-2">
                <Input value={auditInput} onChange={e => setAuditInput(e.target.value)}
                  placeholder={publishedUrl || t('geo.auditPh')} />
                <Button variant="outline" size="sm" onClick={auditPage} disabled={loadingAu}>
                  {loadingAu ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GaugeIcon className="h-3.5 w-3.5" />}
                  {t('geo.auditRun')}
                </Button>
              </div>
              {auditReport && (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-2xl font-bold tabular-nums',
                      auditReport.total >= 75 ? 'text-emerald-600' : auditReport.total >= 50 ? 'text-amber-600' : 'text-red-600')}>
                      {auditReport.total}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 100 GEO Score</span>
                  </div>
                  <div className="space-y-1.5">
                    {auditReport.breakdown.map(b => (
                      <div key={b.key} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0">{b.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${(b.score / b.max) * 100}%` }} />
                          </div>
                          <span className="tabular-nums text-muted-foreground w-12 text-right">{b.score}/{b.max}</span>
                        </div>
                        <p className="ml-2 text-[10px] text-muted-foreground mt-0.5">{b.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 發佈設定（per-user） */}
        {showSettings && (
          <div className="bg-card rounded-xl border p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-indigo-600" /> {t('geo.publishSettings')}
            </h2>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{t('geo.wpSection')}</p>
              <Input value={wpBaseUrl} onChange={e => setWpBaseUrl(e.target.value)} placeholder={t('geo.wpBaseUrlPh')} />
              <Input value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder={t('geo.wpUserPh')} />
              <Input type="password" value={wpAppPassword} onChange={e => setWpAppPassword(e.target.value)}
                placeholder={wpConfigured ? t('geo.secretSetPh') : t('geo.wpPwPh')} />
              <p className="text-[11px] text-muted-foreground">{t('geo.wpHelp')}</p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">{t('geo.webhookSection')}</p>
              <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder={t('geo.webhookUrlPh')} />
              <Input type="password" value={webhookToken} onChange={e => setWebhookToken(e.target.value)}
                placeholder={webhookConfigured ? t('geo.secretSetPh') : t('geo.webhookTokenPh')} />
            </div>

            <Button onClick={saveSettings} disabled={savingSettings} size="sm">
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : settingsSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {settingsSaved ? t('geo.saved') : t('geo.save')}
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: input */}
        <div className="bg-card rounded-xl border p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold">{t('geo.step1')}</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('geo.topic')}</label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder={t('geo.topicPh')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('geo.exclusive')}</label>
            <Textarea value={exclusiveFacts} onChange={e => setExclusiveFacts(e.target.value)}
              placeholder={t('geo.exclusivePh')} rows={4} />
            {facts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted-foreground self-center">{t('geo.insertFact')}</span>
                {facts.filter(f => f.text?.trim()).map((f, i) => (
                  <button key={i} onClick={() => insertFact(f)}
                    className="text-[11px] px-2 py-0.5 rounded-full border bg-card hover:bg-muted">
                    + {f.label?.trim() || f.text!.slice(0, 12)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('geo.author')}</label>
            <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder={t('geo.authorPh')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('geo.targetDomain')}</label>
            <Input value={targetDomain} onChange={e => setTargetDomain(e.target.value)} placeholder={t('geo.targetDomainPh')} />
          </div>
          <Button onClick={explore} disabled={loadingQ} className="w-full">
            {loadingQ ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loadingQ ? t('geo.exploring') : t('geo.explore')}
          </Button>
        </div>

        {/* Step 2: questions */}
        {questions.length > 0 && (
          <div className="bg-card rounded-xl border p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('geo.step2')}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('geo.picked', { n: selected.size, total: questions.length })}</span>
                <Button variant="outline" size="sm" onClick={scoreAll} disabled={loadingS}>
                  {loadingS ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />}
                  {loadingS ? t('geo.scoring') : t('geo.score')}
                </Button>
                <Button variant="outline" size="sm" onClick={clusterPlan} disabled={loadingC}>
                  {loadingC ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                  {loadingC ? t('geo.clustering') : t('geo.cluster')}
                </Button>
              </div>
            </div>

            {clusters.length > 0 && (
              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{t('geo.clusterHint')}</p>
                <div className="flex flex-wrap gap-2">
                  {clusters.map(c => (
                    <button key={c.id} onClick={() => pickCluster(c)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                        activeCluster === c.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'border-border bg-card hover:bg-muted'
                      )}>
                      {c.pillar && <Crown className="h-3 w-3 text-amber-500" />}
                      <span className="font-medium">{c.title}</span>
                      <span className="text-muted-foreground">({c.questionIds.length})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {scored && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('geo.src.measured')}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('geo.src.estimated')}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />{t('geo.src.unknown')}</span>
              </div>
            )}
            <div className="space-y-2">
              {questions.map((q, i) => (
                <label key={q.id} className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                  selected.has(i) ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-border hover:bg-muted/50'
                )}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)}
                    className="mt-0.5 h-4 w-4 accent-indigo-600" />
                  <span className="flex-1 text-sm">{q.question}</span>
                  {q.opportunity_score != null && (
                    <span className="flex items-center gap-1 shrink-0" title={t('geo.opp')}>
                      <span className={cn('h-2 w-2 rounded-full', SOURCE_DOT[q.volume_source ?? 'unknown'])} />
                      <span className="text-xs font-semibold tabular-nums text-indigo-600">{q.opportunity_score}</span>
                    </span>
                  )}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full shrink-0', INTENT_STYLES[q.intent] ?? INTENT_STYLES.info)}>
                    {t(`geo.intent.${q.intent}` as Parameters<typeof t>[0])}
                  </span>
                </label>
              ))}
            </div>
            <Button onClick={generate} disabled={loadingA || selected.size === 0} className="w-full">
              {loadingA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loadingA ? t('geo.generating') : t('geo.generate')}
            </Button>
          </div>
        )}

        {/* Step 3: article */}
        {article && (
          <div className="bg-card rounded-xl border p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                {article.title}
              </h2>
              <Button variant="ghost" size="sm" onClick={generate} disabled={loadingA}>
                <RefreshCw className="h-3.5 w-3.5" /> {t('geo.regenerate')}
              </Button>
            </div>

            {/* Publish + multilingual */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => publish('landing')} disabled={loadingP}>
                {loadingP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                {t('geo.publishLanding')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => publish('wordpress')} disabled={loadingP}>
                <ExternalLink className="h-3.5 w-3.5" /> {t('geo.publishWp')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => publish('webhook')} disabled={loadingP}>
                <ExternalLink className="h-3.5 w-3.5" /> {t('geo.publishWebhook')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => publish('export')} disabled={loadingP}>
                <Download className="h-3.5 w-3.5" /> {t('geo.exportHtml')}
              </Button>
              <span className="mx-1 h-4 w-px bg-border" />
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              {(['zh-TW', 'en', 'vi'] as const).filter(l => l !== locale).map(l => (
                <Button key={l} variant="outline" size="sm" onClick={() => translate(l)} disabled={loadingTr}>
                  {loadingTr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t(`geo.lang.${l}` as Parameters<typeof t>[0])}
                </Button>
              ))}
            </div>
            {publishedUrl && (
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline break-all">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {publishedUrl}
              </a>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t('geo.articleMd')}</span>
                <Button variant="outline" size="sm" onClick={() => copy('md')}>
                  {copied === 'md' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'md' ? t('geo.copied') : t('geo.copy')}
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3 max-h-96 overflow-auto font-mono">{article.body_md}</pre>
            </div>

            {article.json_ld != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Code2 className="h-3.5 w-3.5" /> {t('geo.jsonld')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => copy('jsonld')}>
                    {copied === 'jsonld' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'jsonld' ? t('geo.copied') : t('geo.copy')}
                  </Button>
                </div>
                <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3 max-h-72 overflow-auto font-mono">
                  {typeof article.json_ld === 'string' ? article.json_ld : JSON.stringify(article.json_ld, null, 2)}
                </pre>
                <p className="text-[11px] text-muted-foreground mt-1.5">{t('geo.jsonldHint')}</p>
              </div>
            )}

            {/* 段落可引用度 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" /> {t('geo.citTitle')}
                  {citability && <span className="ml-1 font-bold text-indigo-600">{citability.score}/100</span>}
                </span>
                <Button variant="outline" size="sm" onClick={checkCitability} disabled={loadingCi}>
                  {loadingCi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                  {t('geo.citCheck')}
                </Button>
              </div>
              {citability && (
                <div className="space-y-1.5">
                  {citability.passages.map(p => (
                    <div key={p.index} className={cn('rounded-lg border px-3 py-2 text-xs',
                      p.index === citability.best ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : p.index === citability.weakest ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border')}>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-bold tabular-nums w-8',
                          p.score >= 70 ? 'text-emerald-600' : p.score >= 50 ? 'text-amber-600' : 'text-red-600')}>{p.score}</span>
                        <span className="flex-1 truncate text-muted-foreground">{p.heading ? `【${p.heading}】` : ''}{p.excerpt}</span>
                        {p.index === citability.best && <span className="text-[10px] text-emerald-600 shrink-0">{t('geo.citBest')}</span>}
                        {p.index === citability.weakest && <span className="text-[10px] text-amber-600 shrink-0">{t('geo.citWeak')}</span>}
                      </div>
                      {p.reasons.length > 0 && p.score < 70 && (
                        <ul className="mt-1 ml-10 list-disc text-[11px] text-muted-foreground">
                          {p.reasons.map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: tracking dashboard */}
        {article && (
          <div className="bg-card rounded-xl border p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Radar className="h-4 w-4 text-indigo-600" />
                {t('geo.trackTitle')}
              </h2>
              <Button variant="outline" size="sm" onClick={trackNow} disabled={loadingT}>
                {loadingT ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                {loadingT ? t('geo.tracking') : t('geo.track')}
              </Button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={autoTrack} onClick={toggleAutoTrack}
                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  autoTrack ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600')}>
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  autoTrack ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <span className="text-xs font-medium">{t('geo.autoTrack')}</span>
            </label>
            <p className="text-[11px] text-muted-foreground">{t('geo.trackHint')}</p>
            <p className="text-[11px] text-muted-foreground">{t('geo.trackRecorded')}</p>
            {tracking.length > 0 && (
              <div className="space-y-2">
                {tracking.map(r => {
                  const q = questions.find(x => x.id === r.id)
                  return (
                    <div key={r.id} className="rounded-lg border px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        {r.cited
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          : <XCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
                        <span className="flex-1 text-sm">{q?.question ?? r.id}</span>
                        {r.cited && r.rank != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                            {t('geo.rankN', { n: r.rank })}
                          </span>
                        )}
                      </div>
                      {r.sources.length > 0 && (
                        <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                          {r.sources.slice(0, 6).map((s, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 月報：競品 SoV + 趨勢 + 列印 */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> {t('geo.reportTitle')}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadReport} disabled={loadingR}>
                    {loadingR ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                    {t('geo.reportView')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={printReport}>
                    <Printer className="h-3.5 w-3.5" /> {t('geo.reportPrint')}
                  </Button>
                </div>
              </div>
              {report && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border p-2.5 text-center">
                      <div className="text-lg font-bold text-indigo-600 tabular-nums">{report.latestCitedRate}%</div>
                      <div className="text-[10px] text-muted-foreground">{t('geo.repRate')}</div>
                    </div>
                    <div className="rounded-lg border p-2.5 text-center">
                      <div className="text-lg font-bold text-indigo-600 tabular-nums">{report.ourAppearances}</div>
                      <div className="text-[10px] text-muted-foreground">{t('geo.repCited')}</div>
                    </div>
                    <div className="rounded-lg border p-2.5 text-center">
                      <div className="text-lg font-bold text-amber-600 tabular-nums">{report.dropped.length}</div>
                      <div className="text-[10px] text-muted-foreground">{t('geo.repDropped')}</div>
                    </div>
                  </div>
                  {report.competitors.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">{t('geo.repCompetitors')}</p>
                      <div className="space-y-1">
                        {report.competitors.slice(0, 6).map(c => (
                          <div key={c.domain} className="flex items-center gap-2 text-xs">
                            <span className="w-40 truncate">{c.domain}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${c.share}%` }} />
                            </div>
                            <span className="tabular-nums text-muted-foreground w-10 text-right">{c.share}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.dropped.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-amber-600 mb-1 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" /> {t('geo.repDropList')}
                      </p>
                      <ul className="space-y-0.5">
                        {report.dropped.slice(0, 5).map((d, j) => (
                          <li key={j} className="text-[11px] text-muted-foreground truncate">• {d.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
