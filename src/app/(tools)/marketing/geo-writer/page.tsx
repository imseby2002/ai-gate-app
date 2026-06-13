'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ChevronLeft, Search, Sparkles, Loader2, Copy, Check,
  FileText, Code2, RefreshCw, Gauge, Layers, Crown,
  Radar, CheckCircle2, XCircle, Globe, ExternalLink, Languages,
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

  const [projectId, setProjectId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<GeoQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [clusters, setClusters] = useState<GeoCluster[]>([])
  const [activeCluster, setActiveCluster] = useState<string | null>(null)
  const [article, setArticle] = useState<GeoArticle | null>(null)
  const [tracking, setTracking] = useState<TrackResult[]>([])
  const [loadingT, setLoadingT] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [loadingP, setLoadingP] = useState(false)
  const [loadingTr, setLoadingTr] = useState(false)

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
        body: JSON.stringify({ topic, exclusiveFacts, author, locale }),
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
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoadingA(false) }
  }

  async function publish(mode: 'landing' | 'wordpress') {
    if (!article?.articleId) return
    setError(''); setLoadingP(true)
    try {
      const res = await fetch('/api/marketing/geo/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.articleId, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'error')
      setPublishedUrl(data.url || null)
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
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              {t('geo.title')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('geo.subtitle')}</p>
          </div>
        </div>

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
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('geo.author')}</label>
            <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder={t('geo.authorPh')} />
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
            <p className="text-[11px] text-muted-foreground">{t('geo.trackHint')}</p>
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
          </div>
        )}

      </div>
    </div>
  )
}
