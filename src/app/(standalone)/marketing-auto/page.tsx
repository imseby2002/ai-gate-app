'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Plus, ChevronDown, Loader2, CheckCircle2, AlertCircle,
  XCircle, RefreshCw, Globe, Map, Star, Target, Newspaper, Settings,
  FileText, X, Download, Sparkles, Wand2, Volume2, PhoneCall, PhoneOff, Zap,
  Bell, ShoppingBag, Smartphone, TrendingUp,
  MoreHorizontal, Pencil, Trash2, Check, AlertTriangle, ClipboardList,
  PieChart, Clock as ClockIcon, ThumbsUp, MessageSquare as MessageSquareIcon,
  Lock,
} from 'lucide-react'
import DriveImagePicker from '@/components/marketing/DriveImagePicker'
import { SimulationPanel } from '@/components/marketing/SimulationPanel'
import type { SimulationResult } from '@/app/api/marketing/simulate/route'
import { useMarketingPlan } from '@/components/marketing/PlanGate'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrivePickedImage {
  fileId: string
  name: string
  dataUrl: string    // for display
  publicUrl: string  // for img2img / img2video APIs
  mimeType: string
}

type UnitStatus = 'idle' | 'running' | 'done' | 'error'
type CollectType =
  | 'map' | 'tiktok' | 'facebook' | 'instagram' | 'threads' | 'youtube'
  | 'amazon' | 'shopee' | 'ios_android' | 'news' | 'web' | 'competitors'
  | 'trend' | 'dcard' | 'booking'

interface Campaign {
  id: string
  title: string
  status: string
  updated_at: string
}

interface UnitDef {
  id: number
  icon: React.ElementType
  implemented: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS: UnitDef[] = [
  { id: 1,  icon: Search,     implemented: true  },
  { id: 3,  icon: BarChart3,  implemented: true  },
  { id: 4,  icon: PenLine,    implemented: true  },
  { id: 5,  icon: ImageIcon,  implemented: true  },
  { id: 6,  icon: ImageIcon,  implemented: true  },
  { id: 7,  icon: Film,       implemented: true  },
  { id: 8,  icon: Video,      implemented: true  },
  { id: 9,  icon: Upload,     implemented: true  },
  { id: 11, icon: Mic,        implemented: true  },
]

const SIDE_TOOLS: (UnitDef & { href: string | null })[] = []

interface CollectTypeDef {
  id: CollectType
  emoji: string
  subOptions: string[]
  needsLocation?: boolean
  needsCountry?: boolean
  needsAppIds?: boolean
  needsRssUrls?: boolean
}

const COLLECT_TYPE_DEFS: CollectTypeDef[] = [
  { id: 'map', emoji: '🗺️', needsLocation: true, subOptions: ['info', 'coordinates', 'reviews', 'hours'] },
  { id: 'tiktok', emoji: '📱', subOptions: ['videos', 'comments', 'vendor_info'] },
  { id: 'facebook', emoji: '👥', subOptions: ['posts', 'comments', 'vendor_info'] },
  { id: 'instagram', emoji: '📸', subOptions: ['posts', 'comments', 'vendor_info'] },
  { id: 'threads', emoji: '🧵', subOptions: ['posts', 'comments', 'vendor_info'] },
  { id: 'youtube', emoji: '🎬', subOptions: ['shorts', 'videos', 'comments', 'vendor_info'] },
  { id: 'amazon', emoji: '📦', subOptions: ['products', 'reviews', 'vendor_info'] },
  { id: 'shopee', emoji: '🛒', needsCountry: true, subOptions: ['products', 'reviews', 'vendor_info'] },
  { id: 'ios_android', emoji: '📲', needsAppIds: true, subOptions: ['reviews', 'vendor_info'] },
  { id: 'news', emoji: '🔔', needsRssUrls: true, subOptions: [] },
  { id: 'web', emoji: '🌐', subOptions: [] },
  { id: 'competitors', emoji: '🎯', subOptions: [] },
  { id: 'trend', emoji: '🔥', subOptions: ['reddit', 'hackernews', 'polymarket'] },
  { id: 'dcard', emoji: '💚', subOptions: [] },
  { id: 'booking', emoji: '🏨', subOptions: ['booking', 'airbnb'] },
]

const SHOPEE_COUNTRIES = [
  { code: 'tw', flag: '🇹🇼' }, { code: 'vn', flag: '🇻🇳' }, { code: 'id', flag: '🇮🇩' },
  { code: 'ph', flag: '🇵🇭' }, { code: 'my', flag: '🇲🇾' }, { code: 'th', flag: '🇹🇭' },
  { code: 'sg', flag: '🇸🇬' }, { code: 'br', flag: '🇧🇷' }, { code: 'mx', flag: '🇲🇽' },
  { code: 'co', flag: '🇨🇴' },
]

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function patchCampaign(id: string, body: Record<string, unknown>) {
  await fetch(`/api/marketing/campaign/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UnitStatus }) {
  const t = useTranslations('MA')
  if (status === 'idle') return null
  const cfg = {
    running: { cls: 'bg-blue-100 text-blue-700',  label: t('status.running'), spin: true  },
    done:    { cls: 'bg-green-100 text-green-700', label: t('status.done'),    spin: false },
    error:   { cls: 'bg-red-100 text-red-700',     label: t('status.error'),   spin: false },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.spin && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {cfg.label}
    </span>
  )
}

// ─── Unit 1: 蒐集資訊 ─────────────────────────────────────────────────────────

interface Unit1Data {
  summary?: string
  raw?: string
  types?: CollectType[]
  subOptions?: Record<string, string[]>
  keywords?: string
  location?: string
  shopeeCountry?: string
  appIds?: string[]
  alertRssUrls?: string[]
  language?: string
}

function Unit1Collect({
  campaignId: _campaignId,
  savedData,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit1Data
  onDone: (data: Unit1Data) => void
}) {
  const [selectedTypes, setSelectedTypes] = useState<CollectType[]>(savedData?.types ?? ['web'])
  const [subOptions, setSubOptions] = useState<Record<string, string[]>>(savedData?.subOptions ?? {})
  const [keywords, setKeywords] = useState(savedData?.keywords ?? '')
  const [location, setLocation] = useState(savedData?.location ?? '')
  const [shopeeCountry, setShopeeCountry] = useState(savedData?.shopeeCountry ?? 'tw')
  const [appIds, setAppIds] = useState(savedData?.appIds?.join('\n') ?? '')
  const [alertRssUrls, setAlertRssUrls] = useState(savedData?.alertRssUrls?.join('\n') ?? '')
  const [limit, setLimit] = useState(10)
  const [language, setLanguage] = useState('zh-TW')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit1Data | null>(savedData?.summary ? savedData : null)
  const [tab, setTab] = useState<'summary' | 'raw'>('summary')
  const t = useTranslations('MA')

  const toggleType = (ty: CollectType) => {
    if (selectedTypes.includes(ty)) {
      setSelectedTypes(prev => prev.filter(x => x !== ty))
    } else {
      setSelectedTypes(prev => [...prev, ty])
      const def = COLLECT_TYPE_DEFS.find(d => d.id === ty)
      if (def && def.subOptions.length > 0 && !(subOptions[ty]?.length)) {
        setSubOptions(prev => ({ ...prev, [ty]: [...def.subOptions] }))
      }
    }
  }

  const toggleSub = (type: CollectType, sub: string) => {
    setSubOptions(prev => {
      const cur = prev[type] ?? []
      return { ...prev, [type]: cur.includes(sub) ? cur.filter(x => x !== sub) : [...cur, sub] }
    })
  }

  const run = async () => {
    if (!keywords.trim()) { setError(t('u1.errKeywords')); return }
    if (selectedTypes.length === 0) { setError(t('u1.errTypes')); return }
    setRunning(true); setError('')
    try {
      const res = await fetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: selectedTypes,
          subOptions,
          keywords: keywords.trim(),
          location: location.trim(),
          shopeeCountry,
          appIds: appIds.split('\n').map(s => s.trim()).filter(Boolean),
          alertRssUrls: alertRssUrls.split('\n').map(s => s.trim()).filter(Boolean),
          limit, language,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit1Data = {
        summary: data.summary, raw: data.raw,
        types: selectedTypes, subOptions,
        keywords: keywords.trim(), location: location.trim(),
        shopeeCountry,
        appIds: appIds.split('\n').map(s => s.trim()).filter(Boolean),
        alertRssUrls: alertRssUrls.split('\n').map(s => s.trim()).filter(Boolean),
        language,
      }
      setResult(out)
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Keywords */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">{t('u1.keywords')}</label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
          placeholder={t('u1.keywordsPlaceholder')} />
      </div>

      {/* Type cards */}
      <div>
        <label className="block text-sm font-semibold mb-3">{t('u1.selectChannels')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COLLECT_TYPE_DEFS.map(ct => {
            const selected = selectedTypes.includes(ct.id)
            const curSubs = subOptions[ct.id] ?? ct.subOptions
            return (
              <div key={ct.id}
                className="rounded-xl border-2 overflow-hidden transition-all"
                style={selected ? { borderColor: 'var(--primary)' } : { borderColor: '#e5e7eb' }}>
                {/* Header row — click to toggle */}
                <button type="button" onClick={() => toggleType(ct.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={selected ? { background: 'color-mix(in oklch, var(--primary) 6%, transparent)' } : {}}>
                  <span className="text-xl leading-none">{ct.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{t(`ct.${ct.id}.label`)}</div>
                    <div className="text-[11px] text-muted-foreground/70">{t(`ct.${ct.id}.desc`)}</div>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selected ? 'border-transparent text-white' : 'border-border'
                  }`} style={selected ? { background: 'var(--primary)' } : {}}>
                    {selected && <span className="text-[10px] font-bold">✓</span>}
                  </div>
                </button>
                {/* Sub-options (only when selected and has sub-options) */}
                {selected && ct.subOptions.length > 0 && (
                  <div className="px-3 pb-2.5 pt-1 flex flex-wrap gap-x-3 gap-y-1.5 border-t"
                    style={{ borderColor: 'color-mix(in oklch, var(--primary) 20%, transparent)', background: 'color-mix(in oklch, var(--primary) 3%, transparent)' }}>
                    {ct.subOptions.map(so => (
                      <label key={so} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox"
                          className="rounded"
                          style={{ accentColor: 'var(--primary)' }}
                          checked={curSubs.includes(so)}
                          onChange={() => toggleSub(ct.id, so)}
                        />
                        {t(`sub.${ct.id}.${so}`)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Location (for map) */}
      {selectedTypes.includes('map') && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
          <div className="text-xs font-semibold text-blue-800">🗺️ {t('u1.mapSettings')}</div>
          <div>
            <label className="block text-xs text-blue-700 mb-1">{t('u1.locationLabel')}</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="w-full h-8 px-3 rounded-lg border text-xs outline-none focus:ring-2 bg-white border-blue-200"
              placeholder={t('u1.locationPlaceholder')} />
          </div>
        </div>
      )}

      {/* Shopee country */}
      {selectedTypes.includes('shopee') && (
        <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200">
          <label className="block text-xs font-semibold text-orange-800 mb-2">🛒 {t('u1.shopeeCountry')}</label>
          <div className="flex flex-wrap gap-1.5">
            {SHOPEE_COUNTRIES.map(c => (
              <button key={c.code} type="button" onClick={() => setShopeeCountry(c.code)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                style={shopeeCountry === c.code
                  ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                  : { background: 'white', borderColor: '#e5e7eb' }}>
                {c.flag} {t(`shopee.${c.code}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* App IDs (iOS/Android) */}
      {selectedTypes.includes('ios_android') && (
        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1.5">
          <div className="text-xs font-semibold text-purple-800">📲 {t('u1.appIdTitle')}</div>
          <textarea value={appIds} onChange={e => setAppIds(e.target.value)}
            rows={2} placeholder={'id1234567890\ncom.example.app'}
            className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
          <p className="text-[10px] text-purple-600">{t('u1.appIdHint')}</p>
        </div>
      )}

      {/* Google Alerts RSS (news) */}
      {selectedTypes.includes('news') && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          <div className="text-xs font-semibold text-amber-800">🔔 {t('u1.rssTitle')}</div>
          <textarea value={alertRssUrls} onChange={e => setAlertRssUrls(e.target.value)}
            rows={3} placeholder={'https://www.google.com/alerts/feeds/XXXXX/XXXXX\nhttps://...'}
            className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          <p className="text-[10px] text-amber-700">{t('u1.rssHint')}</p>
        </div>
      )}

      {/* Settings row */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">{t('u1.perTypeCount')}</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
            {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{t('u1.countUnit', { n })}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">{t('u1.language')}</label>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
            <option value="zh-TW">繁體中文</option>
            <option value="zh-CN">簡體中文</option>
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={run} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u1.collecting')}</> : <><Search className="h-4 w-4" />{t('u1.startCollect')}</>}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-b pb-2">
            <span className="text-sm font-semibold text-foreground">{t('u1.resultTitle')}</span>
            <div className="flex gap-1">
              {(['summary', 'raw'] as const).map(tb => (
                <button key={tb} onClick={() => setTab(tb)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    tab === tb ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}>
                  {tb === 'summary' ? t('u1.tabSummary') : t('u1.tabRaw')}
                </button>
              ))}
            </div>
            <button onClick={run} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> {t('u1.recollect')}
            </button>
          </div>
          <div className="p-4 rounded-xl bg-muted/50 border max-h-[520px] overflow-y-auto">
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {tab === 'summary' ? result.summary : result.raw}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Unit 2: 公司資料 ─────────────────────────────────────────────────────────

interface UploadedFile {
  url: string
  name: string
  category: 'logo' | 'image' | 'document' | 'faq'
  mimeType: string
  sizeKb: number
  textContent?: string
}

interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
  notes?: string
}

interface Unit2Data {
  // Basic info
  companyName?: string
  industry?: string
  employees?: string
  capital?: string
  founded?: string
  address?: string
  website?: string
  description?: string
  products?: string
  targetAudience?: string
  // Brand
  brandTone?: string
  competitiveAdvantage?: string
  // Branches
  branches?: Branch[]
  // Files
  files?: UploadedFile[]
}

const INDUSTRY_OPTIONS = [
  '科技/軟體', '製造業', '零售/電商', '金融服務', '醫療健康',
  '餐飲/消費', '教育培訓', '房地產', '物流/運輸', '廣告/行銷', '其他',
]
const EMPLOYEE_OPTIONS = ['1-10人', '11-50人', '51-200人', '201-500人', '501-1000人', '1000人以上']
const TONE_OPTIONS = ['專業/正式', '活潑/年輕', '溫暖/親切', '創新/前衛', '奢華/高端', '親民/平易']

function FileUploadZone({
  category, label, accept, files, uploading,
  onUpload, onRemove,
}: {
  category: UploadedFile['category']
  label: string
  accept: string
  files: UploadedFile[]
  uploading: boolean
  onUpload: (f: File, cat: UploadedFile['category']) => void
  onRemove: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const catFiles = files.filter(f => f.category === category)
  const t = useTranslations('MA')

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <Upload className="h-5 w-5 text-muted-foreground/70 mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">{t('u2.clickUpload')}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{accept.replace(/,/g, ' / ')}</p>
      </div>
      <input
        ref={inputRef} type="file" multiple className="hidden" accept={accept}
        onChange={e => { Array.from(e.target.files ?? []).forEach(f => onUpload(f, category)); e.target.value = '' }}
      />
      {catFiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {catFiles.map(f => (
            <div key={f.url} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
              {f.mimeType.startsWith('image/') ? (
                <img src={f.url} alt={f.name} className="h-8 w-8 object-cover rounded flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground/70 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground/70">{f.sizeKb} KB {f.textContent ? t('u2.textExtracted') : ''}</div>
              </div>
              <button type="button" onClick={() => onRemove(f.url)} className="text-muted-foreground/70 hover:text-red-400 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('u2.uploading')}
        </div>
      )}
    </div>
  )
}

function Unit2CompanyData({
  campaignId: _campaignId,
  savedData,
  onSave,
}: {
  campaignId: string | null
  savedData?: Unit2Data
  onSave: (data: Unit2Data) => void
}) {
  const [form, setForm] = useState<Unit2Data>(savedData ?? {})
  const [files, setFiles] = useState<UploadedFile[]>(savedData?.files ?? [])
  const [branches, setBranches] = useState<Branch[]>(savedData?.branches ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const t = useTranslations('MA')
  const optLabel = (o: string) => t.has(`opt.${o}`) ? t(`opt.${o}`) : o

  const set = (key: keyof Unit2Data, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const emptyBranch = (): Branch => ({ id: crypto.randomUUID(), name: '', address: '', phone: '' })

  const saveBranch = (b: Branch) => {
    setBranches(prev => prev.find(x => x.id === b.id)
      ? prev.map(x => x.id === b.id ? b : x)
      : [...prev, b])
    setEditingBranch(null)
    setShowBranchForm(false)
  }

  const deleteBranch = (id: string) => setBranches(prev => prev.filter(b => b.id !== id))

  const handleUpload = async (file: File, category: UploadedFile['category']) => {
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFiles(prev => [...prev, data as UploadedFile])
    } catch (e) {
      setUploadError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async (url: string) => {
    setFiles(prev => prev.filter(f => f.url !== url))
  }

  const handleSave = async () => {
    setSaving(true)
    const data: Unit2Data = { ...form, files, branches }
    onSave(data)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = (key: keyof Unit2Data, label: string, placeholder: string, multiline?: boolean) => (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={(form[key] as string) ?? ''} onChange={e => set(key, e.target.value)}
          rows={3} placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none" />
      ) : (
        <input value={(form[key] as string) ?? ''} onChange={e => set(key, e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <section>
        <h3 className="text-sm font-bold text-foreground mb-4 pb-2 border-b">{t('u2.basicInfo')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('companyName', t('u2.companyName'), t('u2.companyNamePlaceholder'))}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('u2.industry')}</label>
            <select value={form.industry ?? ''} onChange={e => set('industry', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              <option value="">{t('u2.pleaseSelect')}</option>
              {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('u2.employees')}</label>
            <select value={form.employees ?? ''} onChange={e => set('employees', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              <option value="">{t('u2.pleaseSelect')}</option>
              {EMPLOYEE_OPTIONS.map(o => <option key={o} value={o}>{optLabel(o)}</option>)}
            </select>
          </div>
          {field('capital', t('u2.capital'), t('u2.capitalPlaceholder'))}
          {field('founded', t('u2.founded'), t('u2.foundedPlaceholder'))}
          {field('website', t('u2.website'), 'https://www.example.com')}
        </div>
        <div className="mt-4">
          {field('address', t('u2.address'), t('u2.addressPlaceholder'))}
        </div>
      </section>

      {/* Business Description */}
      <section>
        <h3 className="text-sm font-bold text-foreground mb-4 pb-2 border-b">{t('u2.bizDesc')}</h3>
        <div className="space-y-4">
          {field('description', t('u2.intro'), t('u2.introPlaceholder'), true)}
          {field('products', t('u2.products'), t('u2.productsPlaceholder'), true)}
          {field('targetAudience', t('u2.audience'), t('u2.audiencePlaceholder'), true)}
          {field('competitiveAdvantage', t('u2.advantage'), t('u2.advantagePlaceholder'), true)}
        </div>
      </section>

      {/* Brand */}
      <section>
        <h3 className="text-sm font-bold text-foreground mb-4 pb-2 border-b">{t('u2.brandSettings')}</h3>
        <div>
          <label className="block text-sm font-medium mb-2">{t('u2.brandTone')}</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map(tone => (
              <button key={tone} type="button" onClick={() => set('brandTone', tone)}
                className="px-3 py-1.5 rounded-lg text-sm border transition-all"
                style={form.brandTone === tone
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : {}}>
                {optLabel(tone)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section>
        <div className="flex items-center justify-between pb-2 border-b mb-4">
          <h3 className="text-sm font-bold text-foreground">{t('u2.branches')}</h3>
          <button type="button"
            onClick={() => { setEditingBranch(emptyBranch()); setShowBranchForm(true) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-muted/50 transition-colors">
            <Plus className="h-3.5 w-3.5" />{t('u2.addBranch')}
          </button>
        </div>

        {branches.length === 0 && !showBranchForm && (
          <p className="text-xs text-muted-foreground/70 py-4 text-center">{t('u2.noBranches')}</p>
        )}

        <div className="space-y-2">
          {branches.map(b => (
            <div key={b.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-muted/50">
              <Map className="h-4 w-4 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{b.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{b.address}</div>
                {b.phone && <div className="text-xs text-muted-foreground/70">{b.phone}</div>}
                {b.notes && <div className="text-xs text-muted-foreground/70 italic">{b.notes}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button" onClick={() => { setEditingBranch(b); setShowBranchForm(true) }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground/70 hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => deleteBranch(b.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground/70 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showBranchForm && editingBranch && (
          <div className="mt-3 p-4 rounded-xl border-2 border-dashed space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">{t('u2.branchName')}</label>
                <input value={editingBranch.name}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  placeholder={t('u2.branchNamePlaceholder')}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('u2.phone')}</label>
                <input value={editingBranch.phone ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                  placeholder={t('u2.phonePlaceholder')}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('u2.branchAddress')}</label>
              <input value={editingBranch.address}
                onChange={e => setEditingBranch(prev => prev ? { ...prev, address: e.target.value } : prev)}
                placeholder={t('u2.branchAddressPlaceholder')}
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">{t('u2.lat')}</label>
                <input type="number" value={editingBranch.lat ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, lat: e.target.value ? Number(e.target.value) : undefined } : prev)}
                  placeholder="25.033964"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('u2.lng')}</label>
                <input type="number" value={editingBranch.lng ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, lng: e.target.value ? Number(e.target.value) : undefined } : prev)}
                  placeholder="121.564468"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('u2.notes')}</label>
              <input value={editingBranch.notes ?? ''}
                onChange={e => setEditingBranch(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                placeholder={t('u2.notesPlaceholder')}
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button"
                onClick={() => { if (editingBranch.name && editingBranch.address) saveBranch(editingBranch) }}
                disabled={!editingBranch.name || !editingBranch.address}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'var(--primary)' }}>
                <Check className="h-3.5 w-3.5" />{t('u2.saveBranch')}
              </button>
              <button type="button"
                onClick={() => { setShowBranchForm(false); setEditingBranch(null) }}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-muted/50 transition-colors">
                {t('u2.cancel')}
              </button>
            </div>
          </div>
        )}

        {branches.length > 0 && (
          <p className="text-xs text-muted-foreground/70 mt-3">
            {t('u2.branchCountHint', { count: branches.length })}
          </p>
        )}
      </section>

      {/* Files */}
      <section>
        <h3 className="text-sm font-bold text-foreground mb-4 pb-2 border-b">{t('u2.materials')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FileUploadZone category="logo" label={t('u2.matLogo')}
            accept=".jpg,.jpeg,.png,.svg,.webp" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="image" label={t('u2.matImage')}
            accept=".jpg,.jpeg,.png,.webp,.gif" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="document" label={t('u2.matDoc')}
            accept=".pdf,.docx,.doc,.txt" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="faq" label={t('u2.matFaq')}
            accept=".xlsx,.xls,.csv,.docx,.doc,.txt" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">
          {t('u2.materialsHint')}
        </p>
        {uploadError && (
          <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{uploadError}
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u2.saving')}</> : <><CheckCircle2 className="h-4 w-4" />{t('u2.saveCompany')}</>}
        </button>
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{t('u2.saved')}</span>}
      </div>

      {/* Stats preview */}
      {(form.companyName || files.length > 0 || branches.length > 0) && (
        <div className="p-4 rounded-xl bg-muted/50 border">
          <div className="text-xs font-medium text-muted-foreground mb-3">{t('u2.overview')}</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('u2.companyNameShort'), value: form.companyName || '—' },
              { label: t('u2.industryShort'), value: optLabel(form.industry || '') || '—' },
              { label: t('u2.brandTone'), value: optLabel(form.brandTone || '') || '—' },
              { label: t('u2.employees'), value: optLabel(form.employees || '') || '—' },
              { label: t('u2.branchCount'), value: branches.length > 0 ? t('u2.nBranches', { n: branches.length }) : '—' },
              { label: t('u2.withCoords'), value: branches.filter(b => b.lat && b.lng).length > 0 ? t('u2.nBranches', { n: branches.filter(b => b.lat && b.lng).length }) : '—' },
              { label: t('u2.uploadedFiles'), value: t('u2.nFiles', { n: files.length }) },
              { label: t('u2.textMaterials'), value: t('u2.nExtracted', { n: files.filter(f => f.textContent).length }) },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xs font-bold text-foreground truncate">{s.value}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 3: 分析資料 ─────────────────────────────────────────────────────────

type AnalysisType = 'swot' | 'company' | 'competitor_activity' | 'competitor_performance' | 'content' | 'marketing'

interface Unit3Data {
  types?: AnalysisType[]
  results?: Record<string, string>
  metrics?: { opportunity: number; competitors: number; audience: string; score: number }
  simulation?: SimulationResult
}

const ANALYSIS_TYPE_DEFS: { id: AnalysisType }[] = [
  { id: 'swot' }, { id: 'company' }, { id: 'competitor_activity' },
  { id: 'competitor_performance' }, { id: 'content' }, { id: 'marketing' },
]

function Unit3Analyze({
  campaignId: _campaignId,
  savedData,
  unit1Data,
  unit2Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit3Data
  unit1Data?: { summary?: string; raw?: string; language?: string }
  unit2Data?: Unit2Data
  onDone: (data: Unit3Data) => void
}) {
  const language = unit1Data?.language ?? 'zh-TW'
  const [selectedTypes, setSelectedTypes] = useState<AnalysisType[]>(
    savedData?.types ?? ['swot', 'marketing']
  )
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit3Data | null>(savedData?.results ? savedData : null)
  const [activeTab, setActiveTab] = useState<string>('')
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; textContent: string }[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  // Simulation state
  const [simRunning, setSimRunning] = useState(false)
  const [simError, setSimError] = useState('')
  const [simResult, setSimResult] = useState<SimulationResult | null>(savedData?.simulation ?? null)
  const t = useTranslations('MA')

  useEffect(() => {
    if (result?.types?.length && !activeTab) setActiveTab(result.types[0])
  }, [result, activeTab])

  const toggleType = (ty: AnalysisType) =>
    setSelectedTypes(prev => prev.includes(ty) ? prev.filter(x => x !== ty) : [...prev, ty])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingFile(true)
    for (const file of files) {
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('category', 'document')
        const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
        const data = await res.json()
        if (data.textContent) {
          setUploadedFiles(prev => [...prev, { name: file.name, textContent: data.textContent }])
        }
      } catch { /* silent */ }
    }
    setUploadingFile(false)
    e.target.value = ''
  }

  const run = async () => {
    if (selectedTypes.length === 0) { setError(t('u3.errTypes')); return }
    setRunning(true); setError('')
    try {
      const extraContext = uploadedFiles.length
        ? uploadedFiles.map(f => `【${f.name}】\n${f.textContent}`).join('\n\n')
        : undefined
      const res = await fetch('/api/marketing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: selectedTypes,
          collectedData: unit1Data?.summary ?? '',
          companyData: unit2Data ?? {},
          extraContext,
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit3Data = { types: selectedTypes, results: data.results, metrics: data.metrics, simulation: simResult ?? undefined }
      setResult(out)
      setActiveTab(selectedTypes[0])
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const runSimulation = async (scenario?: string) => {
    setSimRunning(true); setSimError('')
    try {
      const res = await fetch('/api/marketing/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyData: unit2Data ?? {},
          collectedData: unit1Data?.summary ?? '',
          analysisData: result ?? {},
          personaCount: 10,
          scenario: scenario ?? '',
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const sim = data as SimulationResult
      setSimResult(sim)
      // Persist simulation result alongside analysis data
      if (result) {
        const updated: Unit3Data = { ...result, simulation: sim }
        onDone(updated)
      }
    } catch (e) {
      setSimError(String(e))
    } finally {
      setSimRunning(false)
    }
  }

  const hasUnit1 = !!unit1Data?.summary
  const hasUnit2 = !!unit2Data?.companyName

  return (
    <div className="space-y-6">
      {/* Data source status */}
      <div className="flex gap-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${hasUnit1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'}`}>
          {hasUnit1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {t('u3.unit1')} {hasUnit1 ? t('u3.loaded') : t('u3.notRun')}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${hasUnit2 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'}`}>
          {hasUnit2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {t('u3.unit2')} {hasUnit2 ? `(${unit2Data?.companyName})` : t('u3.notFilled')}
        </div>
      </div>

      {/* File upload for extra context */}
      <div className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t('u3.extraTitle')}</div>
            <div className="text-xs text-muted-foreground/70 mt-0.5">{t('u3.extraHint')}</div>
          </div>
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer transition-opacity ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ background: 'var(--primary)' }}>
            {uploadingFile
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('u3.uploading')}</>
              : <><Upload className="h-3.5 w-3.5" />{t('u3.chooseFile')}</>}
            <input type="file" className="hidden" multiple
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
              onChange={handleFileUpload} />
          </label>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="space-y-1.5">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border text-xs">
                <span className="text-foreground truncate max-w-[80%]">{f.name}</span>
                <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground/70 hover:text-red-500 ml-2 flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis type selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">{t('u3.selectItems')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANALYSIS_TYPE_DEFS.map(at => {
            const selected = selectedTypes.includes(at.id)
            return (
              <button key={at.id} type="button" onClick={() => toggleType(at.id)}
                className="flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all"
                style={selected
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                  : { borderColor: '#e5e7eb' }}>
                <div className={`w-4 h-4 rounded border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${selected ? 'border-0' : 'border-border'}`}
                  style={selected ? { background: 'var(--primary)' } : {}}>
                  {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{t(`u3.type.${at.id}.label`)}</div>
                  <div className="text-xs text-muted-foreground/70 mt-0.5">{t(`u3.type.${at.id}.desc`)}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={run} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u3.analyzing')}</> : <><BarChart3 className="h-4 w-4" />{t('u3.startAnalyze')}</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Metrics */}
          {result.metrics && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: t('u3.mOpportunity'), value: `${result.metrics.opportunity}/100`, color: 'text-green-600' },
                { label: t('u3.mCompetitors'), value: t('u3.nCompetitors', { n: result.metrics.competitors }),  color: 'text-blue-600' },
                { label: t('u3.mAudience'),    value: result.metrics.audience,             color: 'text-purple-600' },
                { label: t('u3.mScore'),       value: `${result.metrics.score}/100`,       color: 'text-amber-600' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-xl bg-muted/50 text-center border">
                  <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tab selector */}
          {result.types && result.types.length > 1 && (
            <div className="flex gap-1.5 flex-wrap border-b pb-2">
              {result.types.map(ty => (
                <button key={ty} onClick={() => setActiveTab(ty)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === ty ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}>
                  {t.has(`u3.type.${ty}.label`) ? t(`u3.type.${ty}.label`) : ty}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          {activeTab && result.results?.[activeTab] && (
            <div className="p-5 rounded-xl bg-muted/50 border max-h-[550px] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.has(`u3.type.${activeTab}.label`) ? t(`u3.type.${activeTab}.label`) : activeTab} — Gemini 1.5 Flash
                </span>
                <button onClick={run} disabled={running}
                  className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> {t('u3.reanalyze')}
                </button>
              </div>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {result.results[activeTab]}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── 消費者模擬 ── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                <Zap className="h-3 w-3 text-amber-600" />
              </span>
              {t('u3.simTitle')}
            </h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5 ml-7">
              {t('u3.simHint')}
            </p>
          </div>
          {!simResult && (
            <button
              onClick={() => runSimulation()}
              disabled={simRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all bg-amber-500 hover:bg-amber-600"
            >
              {simRunning
                ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u3.simulating')}</>
                : <><BarChart3 className="h-4 w-4" />{t('u3.runSim')}</>
              }
            </button>
          )}
        </div>

        {simError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{simError}
          </div>
        )}

        {simResult && (
          <SimulationPanel
            result={simResult}
            onRerun={runSimulation}
            isRunning={simRunning}
          />
        )}
      </div>
    </div>
  )
}

// ─── Unit 4: 文案產出 ─────────────────────────────────────────────────────────

type CopyType =
  | 'facebook_post' | 'instagram_caption' | 'threads_post' | 'line_message'
  | 'twitter_post'  | 'linkedin_post'     | 'youtube_description'
  | 'ad_headline'   | 'email_subject'     | 'email_body'   | 'press_release'
  | 'anchor_script'

interface Unit4Data {
  types?: CopyType[]
  results?: Record<string, string>
  userInstructions?: string
  feedback?: string
  anchorDuration?: number   // seconds for anchor_script generation
  anchorStyle?: string
}

const COPY_TYPE_DEFS: { id: CopyType; group: string }[] = [
  { id: 'facebook_post',       group: 'social' },
  { id: 'instagram_caption',   group: 'social' },
  { id: 'threads_post',        group: 'social' },
  { id: 'line_message',        group: 'social' },
  { id: 'twitter_post',        group: 'social' },
  { id: 'linkedin_post',       group: 'social' },
  { id: 'youtube_description', group: 'video' },
  { id: 'ad_headline',         group: 'ad' },
  { id: 'email_subject',       group: 'email' },
  { id: 'email_body',          group: 'email' },
  { id: 'press_release',       group: 'other' },
  { id: 'anchor_script',       group: 'anchor' },
]

function Unit4Copy({
  campaignId: _campaignId,
  savedData,
  unit1Data,
  unit2Data,
  unit3Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit4Data
  unit1Data?: { summary?: string; language?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  onDone: (data: Unit4Data) => void
}) {
  const language = unit1Data?.language ?? 'zh-TW'
  const [selectedTypes, setSelectedTypes] = useState<CopyType[]>(
    savedData?.types ?? ['facebook_post', 'instagram_caption']
  )
  const [instructions, setInstructions] = useState(savedData?.userInstructions ?? '')
  const [feedback, setFeedback] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit4Data | null>(savedData?.results ? savedData : null)
  const [activeTab, setActiveTab] = useState<CopyType | ''>('')
  const [editedCopy, setEditedCopy] = useState<Record<string, string>>({})

  // Anchor script settings (only relevant when anchor_script is selected)
  const [anchorDuration, setAnchorDuration] = useState(savedData?.anchorDuration ?? 60)
  const [anchorStyle, setAnchorStyle] = useState(savedData?.anchorStyle ?? '專業親切')
  const t = useTranslations('MA')
  const styleLabel = (s: string) => t.has(`u4.style.${s}`) ? t(`u4.style.${s}`) : s

  // Persist types + anchor settings immediately when they change (don't wait for run())
  const unit4InitRef = useRef(false)
  useEffect(() => {
    if (!unit4InitRef.current) { unit4InitRef.current = true; return }
    onDone({
      types: selectedTypes,
      results: result?.results,
      userInstructions: instructions,
      anchorDuration,
      anchorStyle,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes, anchorDuration, anchorStyle])

  useEffect(() => {
    if (result?.types?.length && !activeTab) setActiveTab(result.types[0])
  }, [result, activeTab])

  const toggleType = (ty: CopyType) =>
    setSelectedTypes(prev => prev.includes(ty) ? prev.filter(x => x !== ty) : [...prev, ty])

  const run = async (fb?: string) => {
    if (selectedTypes.length === 0) { setError(t('u4.errTypes')); return }
    setRunning(true); setError('')
    try {
      const regularTypes = selectedTypes.filter(ty => ty !== 'anchor_script')
      const needAnchor   = selectedTypes.includes('anchor_script')
      let results: Record<string, string> = {}

      // Generate regular copy types
      if (regularTypes.length > 0) {
        const res = await fetch('/api/marketing/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            copyTypes: regularTypes,
            userInstructions: instructions,
            companyData: unit2Data ?? {},
            analysisData: unit3Data ?? {},
            collectedSummary: unit1Data?.summary ?? '',
            feedback: fb ?? '',
            language,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        results = { ...data.results }
      }

      // Generate anchor script separately (duration-based, uses avatar-script API)
      if (needAnchor) {
        const res = await fetch('/api/marketing/avatar-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count: 1,
            duration: anchorDuration,
            style: anchorStyle,
            companyData: unit2Data ?? {},
            analysisData: unit3Data ?? {},
            collectedSummary: unit1Data?.summary ?? '',
            existingCopies: results,
            language,
          }),
        })
        const data = await res.json()
        if (data.scripts?.[0]) {
          results['anchor_script'] = data.scripts[0]
        } else if (data.error) {
          throw new Error(t('u4.anchorGenFailed', { error: data.error }))
        }
      }

      const out: Unit4Data = {
        types: selectedTypes,
        results,
        userInstructions: instructions,
        anchorDuration: needAnchor ? anchorDuration : undefined,
        anchorStyle:    needAnchor ? anchorStyle    : undefined,
      }
      setResult(out)
      setEditedCopy(results)
      setActiveTab(selectedTypes[0])
      setFeedback('')
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  // Group copy types
  const groups = [...new Set(COPY_TYPE_DEFS.map(d => d.group))]

  const displayCopy = (t: string) => editedCopy[t] ?? result?.results?.[t] ?? ''

  return (
    <div className="space-y-6">
      {/* Context status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: t('u4.ctxCollect'), ok: !!unit1Data?.summary },
          { label: t('u4.ctxCompany'), ok: !!unit2Data?.companyName },
          { label: t('u4.ctxAnalysis'), ok: !!unit3Data?.results },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Copy type selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">{t('u4.selectTypes')}</label>
        {groups.map(g => (
          <div key={g} className="mb-3">
            <div className="text-xs font-medium text-muted-foreground/70 mb-1.5">{t(`u4.group.${g}`)}</div>
            <div className="flex flex-wrap gap-2">
              {COPY_TYPE_DEFS.filter(d => d.group === g).map(d => {
                const sel = selectedTypes.includes(d.id)
                return (
                  <button key={d.id} type="button" onClick={() => toggleType(d.id)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                    style={sel
                      ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                      : {}}>
                    {t(`u4.copy.${d.id}`)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Anchor script settings — show when anchor_script is selected */}
      {selectedTypes.includes('anchor_script') && (
        <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-sm text-indigo-800">🎙️ {t('u4.anchorTitle')}</span>
            <span className="text-[10px] text-indigo-500 ml-1">{t('u4.anchorSubtitle')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-indigo-700 block mb-1">{t('u4.videoDuration')}</label>
              <select value={anchorDuration} onChange={e => setAnchorDuration(Number(e.target.value))}
                className="w-full text-sm border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {[15,30,60,90,120,180,300].map(s => (
                  <option key={s} value={s}>{t('u4.durationOpt', { s, chars: Math.round(s * 4.5) })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-indigo-700 block mb-1">{t('u4.anchorStyle')}</label>
              <select value={anchorStyle} onChange={e => setAnchorStyle(e.target.value)}
                className="w-full text-sm border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {['專業親切','熱情活力','沉穩信任','輕鬆幽默','商務正式'].map(s => (
                  <option key={s} value={s}>{styleLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-indigo-600">
            {t('u4.anchorNote')}
          </p>
        </div>
      )}

      {/* User instructions */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {t('u4.userRules')}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">{t('u4.userRulesHint')}</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder={t('u4.userRulesPlaceholder')} />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={() => run()} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u4.generating')}</> : <><PenLine className="h-4 w-4" />{t('u4.generate')}</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex gap-1.5 flex-wrap border-b pb-2">
            {result.types?.map(ty => (
              <button key={ty} onClick={() => setActiveTab(ty)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === ty ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}>
                {t.has(`u4.copy.${ty}`) ? t(`u4.copy.${ty}`) : ty}
              </button>
            ))}
          </div>

          {/* Active copy editor */}
          {activeTab && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/70">
                  {t.has(`u4.copy.${activeTab}`) ? t(`u4.copy.${activeTab}`) : activeTab}{t('u4.editableHint')}
                </span>
                <button onClick={() => run()} disabled={running}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> {t('u4.regenerate')}
                </button>
              </div>
              <textarea
                value={displayCopy(activeTab)}
                onChange={e => setEditedCopy(prev => ({ ...prev, [activeTab]: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 resize-none font-sans leading-relaxed"
              />
            </div>
          )}

          {/* Feedback & regenerate */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="text-xs font-semibold text-amber-800">{t('u4.feedbackTitle')}</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder={t('u4.feedbackPlaceholder')}
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {t('u4.regenAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 5: 圖片腳本 ─────────────────────────────────────────────────────────

interface ImageScript {
  id: number
  content: string
}

interface Unit5Data {
  count?: number
  platforms?: string[]
  scripts?: ImageScript[]
  userInstructions?: string
}

const IMAGE_PLATFORM_OPTIONS: { id: string; label: string }[] = [
  { id: 'facebook_post',     label: 'Facebook' },
  { id: 'instagram_caption', label: 'Instagram' },
  { id: 'threads_post',      label: 'Threads' },
  { id: 'line_message',      label: 'LINE' },
  { id: 'twitter_post',      label: 'Twitter/X' },
  { id: 'linkedin_post',     label: 'LinkedIn' },
  { id: 'youtube_description', label: 'YouTube' },
]

function Unit5ImageScript({
  campaignId: _campaignId,
  savedData,
  unit1Data,
  unit2Data,
  unit3Data,
  unit4Data,
  driveFolderId,
  driveFolderName,
  drivePickedImage,
  onDriveFolderChange,
  onDriveImagePicked,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit5Data
  unit1Data?: { summary?: string; language?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  unit4Data?: Unit4Data
  driveFolderId?: string
  driveFolderName?: string
  drivePickedImage?: DrivePickedImage | null
  onDriveFolderChange: (id: string, name: string) => void
  onDriveImagePicked: (img: DrivePickedImage | null) => void
  onDone: (data: Unit5Data) => void
}) {
  const language = unit1Data?.language ?? 'zh-TW'
  const [count, setCount] = useState(savedData?.count ?? 3)
  const [platforms, setPlatforms] = useState<string[]>(
    savedData?.platforms ?? ['facebook_post', 'instagram_caption']
  )
  const [instructions, setInstructions] = useState(savedData?.userInstructions ?? '')
  const [useRefImage, setUseRefImage] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit5Data | null>(savedData?.scripts?.length ? savedData : null)
  const [activeScript, setActiveScript] = useState(1)
  const t = useTranslations('MA')

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const run = async (fb?: string) => {
    setRunning(true); setError('')
    const refImg = useRefImage && drivePickedImage
      ? { base64: drivePickedImage.dataUrl.split(',')[1], mimeType: drivePickedImage.mimeType, name: drivePickedImage.name }
      : undefined
    try {
      const res = await fetch('/api/marketing/image-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          platforms,
          userInstructions: instructions,
          companyData: unit2Data ?? {},
          analysisData: unit3Data ?? {},
          copyData: unit4Data ?? {},
          collectedSummary: unit1Data?.summary ?? '',
          feedback: fb ?? '',
          referenceImage: refImg,
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit5Data = {
        count,
        platforms,
        scripts: data.scripts,
        userInstructions: instructions,
      }
      setResult(out)
      setActiveScript(1)
      setFeedback('')
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const hasUnit2 = !!unit2Data?.companyName
  const hasUnit4 = !!unit4Data?.results

  return (
    <div className="space-y-6">
      {/* Context status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: t('u4.ctxCollect'), ok: !!unit1Data?.summary },
          { label: t('u4.ctxCompany'), ok: hasUnit2 },
          { label: t('u4.ctxAnalysis'), ok: !!unit3Data?.results },
          { label: t('u5.ctxCopy'), ok: hasUnit4 },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Count selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u5.imageCount')}</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
            <button key={n} type="button" onClick={() => setCount(n)}
              className="w-10 h-10 rounded-lg border text-sm font-medium transition-all"
              style={count === n
                ? { borderColor: 'var(--primary)', background: 'var(--primary)', color: 'white' }
                : { background: 'white' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Platform selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u5.targetPlatforms')}</label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_PLATFORM_OPTIONS.map(p => {
            const sel = platforms.includes(p.id)
            return (
              <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : {}}>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* User instructions */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {t('u5.specialRules')}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">{t('u5.specialRulesHint')}</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder={t('u5.specialRulesPlaceholder')} />
      </div>

      {/* Drive reference image */}
      <div className="p-4 rounded-xl border border-dashed border-border space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">{t('u5.refImage')}</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useRefImage} onChange={e => setUseRefImage(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-xs text-muted-foreground">{t('u5.enable')}</span>
          </label>
        </div>
        {useRefImage && (
          <DriveImagePicker
            folderId={driveFolderId}
            folderName={driveFolderName}
            onFolderChange={onDriveFolderChange}
            onImagePicked={onDriveImagePicked}
            pickedImage={drivePickedImage ?? null}
            label={t('u5.drivePickLabel')}
          />
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={() => run()} disabled={running || (useRefImage && !drivePickedImage)}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running
          ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u5.generatingScript')}</>
          : <><ImageIcon className="h-4 w-4" />{useRefImage && drivePickedImage ? t('u5.genWithRef') : t('u5.genScript')}</>}
      </button>

      {/* Results */}
      {result && result.scripts && result.scripts.length > 0 && (
        <div className="space-y-3">
          {/* Script tab bar */}
          <div className="flex gap-1.5 flex-wrap border-b pb-2">
            {result.scripts.map(s => (
              <button key={s.id} onClick={() => setActiveScript(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeScript === s.id ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}>
                {t('u5.imageN', { n: s.id })}
              </button>
            ))}
            <button onClick={() => run()} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> {t('u4.regenerate')}
            </button>
          </div>

          {/* Active script content */}
          {result.scripts.find(s => s.id === activeScript) && (
            <div className="p-5 rounded-xl bg-muted/50 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('u5.scriptTitle', { n: activeScript })}
                </span>
                <span className="text-[10px] text-muted-foreground/70 bg-white border rounded-full px-2 py-0.5">
                  {t('u5.totalImages', { n: result.scripts.length })}
                </span>
              </div>
              {useRefImage && drivePickedImage && (
                <div className="mb-3 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drivePickedImage.dataUrl} alt={drivePickedImage.name}
                    className="w-24 h-24 object-cover rounded-lg border shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground mb-0.5">{t('u5.refImageLabel')}</div>
                    <div className="truncate">{drivePickedImage.name}</div>
                    <div className="text-muted-foreground/70 mt-1">{t('u5.refGenerated')}</div>
                  </div>
                </div>
              )}
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                {result.scripts.find(s => s.id === activeScript)?.content}
              </pre>
            </div>
          )}

          {/* Feedback */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="text-xs font-semibold text-amber-800">{t('u5.feedbackTitle')}</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder={t('u5.feedbackPlaceholder')}
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {t('u4.regenAll')}
              </button>
            </div>
          </div>

          {/* Copy AI prompt hint */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1">💡 {t('u5.tipTitle')}</div>
            <div className="text-xs text-blue-600">
              {t.rich('u5.tipBody', { b: (c) => <strong>{c}</strong> })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 6: 圖片產出 ─────────────────────────────────────────────────────────

interface GeneratedImage {
  scriptId: number
  url: string
  prompt: string
  revisedPrompt?: string
  model: string
  size: string
  quality: string
  style: string
  cost: number
  generatedAt: string
}

interface Unit6Data {
  images?: GeneratedImage[]
}

type ImageModel = 'dalle3' | 'flux' | 'nano'

const IMAGE_MODELS: { id: ImageModel; name: string; cost: string }[] = [
  { id: 'flux',   name: 'FLUX.1 Pro',   cost: '$0.05' },
  { id: 'dalle3', name: 'DALL-E 3',     cost: '$0.08' },
  { id: 'nano',   name: 'Nano Banana',  cost: '$0.02' },
]

const SIZE_OPTIONS = [
  { value: '1:1',  hint: 'IG/FB' },
  { value: '9:16', hint: 'Reels/Stories' },
  { value: '16:9', hint: 'YouTube/LinkedIn' },
]

// Extract AI prompt from script content
function extractPrompt(content: string): string {
  if (!content?.trim()) return ''
  // 1. Content inside a code block after the label
  const codeBlockMatch = content.match(/AI\s*生成\s*Prompt[：:][^\n]*\n```[^\n]*\n([\s\S]+?)```/i)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  // 2. Same line or next non-empty line after the label
  const patterns = [
    /AI\s*生成\s*Prompt[：:]\**\s*(.+?)(?:\n|$)/i,
    /Prompt[：:]\**\s*(.+?)(?:\n|$)/i,
  ]
  for (const re of patterns) {
    const m = content.match(re)
    if (m) {
      const same = m[1].replace(/\*+/g, '').trim()
      if (same.length > 3) return same
      const matchEnd = (m.index ?? 0) + m[0].length
      const nextLine = content.slice(matchEnd).split('\n')
        .find(l => l.trim().length > 3 && !l.trim().startsWith('`'))
      if (nextLine) return nextLine.replace(/\*+/g, '').trim()
    }
  }
  return ''
}

// Builds a richer image gen prompt from a Unit 5 script:
// AI Prompt (base) + 視覺場景 + 色調風格
function buildImageGenPrompt(content: string): string {
  if (!content?.trim()) return ''
  const aiPrompt = extractPrompt(content)

  const extractField = (label: string) => {
    const re = new RegExp(`${label}[：:]\\**\\s*([\\s\\S]+?)(?=\\n\\s*\\d+[\\.、]|\\n===|$)`, 'i')
    const m = content.match(re)
    return m ? m[1].replace(/\*+/g, '').replace(/\n+/g, ' ').trim().slice(0, 120) : ''
  }

  const scene = extractField('視覺場景')
  const style = extractField('色調風格')

  const parts = [aiPrompt, scene, style].filter(s => s.length > 3)
  return parts.join('. ')
}

function Unit6ImageGenerate({
  campaignId: _campaignId,
  savedData,
  unit5Data,
  driveFolderId,
  driveFolderName,
  drivePickedImage,
  onDriveFolderChange,
  onDriveImagePicked,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit6Data
  unit5Data?: Unit5Data
  driveFolderId?: string
  driveFolderName?: string
  drivePickedImage?: DrivePickedImage | null
  onDriveFolderChange: (id: string, name: string) => void
  onDriveImagePicked: (img: DrivePickedImage | null) => void
  onDone: (data: Unit6Data) => void
}) {
  const scripts = unit5Data?.scripts ?? []
  const t = useTranslations('MA')
  const locale = useLocale()

  const [model, setModel] = useState<ImageModel>('flux')
  const [size, setSize] = useState('1:1')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid')
  const [prompts, setPrompts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    scripts.forEach(s => { init[s.id] = buildImageGenPrompt(s.content) })
    return init
  })
  const [userEditedPrompts6, setUserEditedPrompts6] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [images, setImages] = useState<GeneratedImage[]>(savedData?.images ?? [])
  const [manualPrompt, setManualPrompt] = useState('')
  const [manualGenerating, setManualGenerating] = useState(false)
  const [manualError, setManualError] = useState('')

  useEffect(() => {
    setPrompts(prev => {
      const next = { ...prev }
      scripts.forEach(s => {
        if (!userEditedPrompts6.has(s.id)) next[s.id] = buildImageGenPrompt(s.content)
      })
      return next
    })
  }, [scripts, userEditedPrompts6])

  const hasUnit5 = scripts.length > 0

  const [useRefImg, setUseRefImg] = useState(false)

  const buildPayload = (prompt: string, scriptId: number) => ({
    prompt, scriptId, model, size, quality, style,
    ...(useRefImg && drivePickedImage ? { imageUrl: drivePickedImage.publicUrl } : {}),
  })

  const generateOne = async (scriptId: number) => {
    const prompt = prompts[scriptId]?.trim()
    if (!prompt) { setErrors(prev => ({ ...prev, [scriptId]: t('u6.promptEmpty') })); return }
    setGenerating(prev => ({ ...prev, [scriptId]: true }))
    setErrors(prev => ({ ...prev, [scriptId]: '' }))
    try {
      const res = await fetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(prompt, scriptId)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const img: GeneratedImage = data
      setImages(prev => {
        const next = [...prev.filter(i => i.scriptId !== scriptId), img]
        onDone({ images: next }); return next
      })
    } catch (e) {
      setErrors(prev => ({ ...prev, [scriptId]: String(e) }))
    } finally {
      setGenerating(prev => ({ ...prev, [scriptId]: false }))
    }
  }

  const generateManual = async () => {
    if (!manualPrompt.trim()) { setManualError(t('u6.promptRequired')); return }
    setManualGenerating(true); setManualError('')
    try {
      const res = await fetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(manualPrompt.trim(), Date.now())),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImages(prev => {
        const next = [...prev, data as GeneratedImage]
        onDone({ images: next }); return next
      })
      setManualPrompt('')
    } catch (e) {
      setManualError(String(e))
    } finally {
      setManualGenerating(false)
    }
  }

  const removeImage = (url: string) => {
    setImages(prev => { const next = prev.filter(i => i.url !== url); onDone({ images: next }); return next })
    // 同步刪除 Supabase Storage（fire-and-forget）
    fetch('/api/marketing/delete-asset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {/* 靜默失敗，不影響 UI */})
  }

  const modelInfo = IMAGE_MODELS.find(m => m.id === model)!

  return (
    <div className="space-y-6">

      {/* Model selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">{t('u6.selectModel')}</label>
        <div className="grid grid-cols-3 gap-3">
          {IMAGE_MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)}
              className="relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
              style={model === m.id
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                : { borderColor: '#e5e7eb', background: 'white' }}>
              <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={model === m.id
                  ? { background: 'var(--primary)', color: 'white' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {t(`u6.model.${m.id}.badge`)}
              </span>
              <span className="text-sm font-bold text-foreground pr-8">{m.name}</span>
              <span className="text-[10px] text-muted-foreground/70 mt-1 leading-snug">{t(`u6.model.${m.id}.desc`)}</span>
              <span className="text-xs font-semibold mt-2" style={{ color: 'var(--primary)' }}>{m.cost}{t('u6.costUnit')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Image settings */}
      <div className="p-4 rounded-xl bg-muted/50 border space-y-4">
        <div className="text-xs font-semibold text-muted-foreground">{t('u6.imageSettings')}</div>
        <div className="flex flex-wrap gap-6">
          {/* Size */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">{t('u6.sizeRatio')}</div>
            <div className="flex gap-2">
              {SIZE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSize(opt.value)}
                  className="flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all"
                  style={size === opt.value
                    ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                    : { background: 'white' }}>
                  <span className="font-medium">{t(`u6.size.${opt.value}`)}</span>
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {/* DALL-E 3 only options */}
          {model === 'dalle3' && (
            <>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">{t('u6.quality')}</div>
                <div className="flex gap-2">
                  {(['standard', 'hd'] as const).map(q => (
                    <button key={q} onClick={() => setQuality(q)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={quality === q
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : { background: 'white' }}>
                      {q === 'standard' ? t('u6.qStandard') : t('u6.qHd')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">{t('u6.styleLabel')}</div>
                <div className="flex gap-2">
                  {(['vivid', 'natural'] as const).map(st => (
                    <button key={st} onClick={() => setStyle(st)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={style === st
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : { background: 'white' }}>
                      {st === 'vivid' ? t('u6.sVivid') : t('u6.sNatural')}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reference image (img2img) */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {t('u6.refImgTitle')}
          </div>
          <button onClick={() => setUseRefImg(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all"
            style={useRefImg
              ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
              : { background: 'white' }}>
            {useRefImg ? t('u6.enabled') : t('u6.useRefImg')}
          </button>
        </div>
        {useRefImg && (
          <DriveImagePicker
            folderId={driveFolderId}
            folderName={driveFolderName}
            onFolderChange={onDriveFolderChange}
            onImagePicked={onDriveImagePicked}
            pickedImage={drivePickedImage ?? null}
            label={t('u6.refImgPickLabel')}
          />
        )}
        {useRefImg && drivePickedImage && (
          <p className="text-[10px] text-blue-600">{t('u6.refImgChosen')}</p>
        )}
        {!useRefImg && (
          <p className="text-[10px] text-blue-500">{t('u6.refImgHint')}</p>
        )}
      </div>

      {/* Scripts from Unit 5 */}
      {hasUnit5 ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            {t('u6.fromScripts', { n: scripts.length })}
          </div>
          {scripts.map(s => {
            const img = images.find(i => i.scriptId === s.id)
            const isGen = generating[s.id]
            const err = errors[s.id]
            const modelLabel = IMAGE_MODELS.find(m => m.id === img?.model)?.name ?? img?.model
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{t('u5.imageN', { n: s.id })}</span>
                  {img && (
                    <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      {t('u6.generated')} · {modelLabel}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      {t('u6.aiPrompt')} <span className="text-muted-foreground/70 font-normal">{t('u6.editable')}</span>
                    </label>
                    <textarea
                      value={prompts[s.id] ?? ''}
                      onChange={e => {
                        setUserEditedPrompts6(prev => new Set(prev).add(s.id))
                        setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))
                      }}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none font-mono"
                      placeholder={t('u6.promptPlaceholder')}
                    />
                  </div>
                  {err && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{err}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button onClick={() => generateOne(s.id)} disabled={isGen}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-opacity"
                      style={{ background: 'var(--primary)' }}>
                      {isGen
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('u6.modelGenerating', { model: modelInfo.name })}</>
                        : <><Sparkles className="h-3.5 w-3.5" />{img ? t('u4.regenerate') : t('u6.genWithModel', { model: modelInfo.name })}</>}
                    </button>
                    {img && (
                      <span className="text-[10px] text-muted-foreground/70">
                        {img.size} · {modelInfo.cost}{t('u6.costUnit')} · {new Date(img.generatedAt).toLocaleTimeString(locale)}
                      </span>
                    )}
                  </div>
                  {img && (
                    <div className="relative rounded-xl overflow-hidden border bg-muted/50">
                      <img src={img.url} alt={t('u5.imageN', { n: s.id })} className="w-full object-contain max-h-96" />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <a href={img.url} download={`img-${s.id}.png`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] hover:bg-black/80">
                          <Download className="h-3 w-3" /> {t('u6.download')}
                        </a>
                        <button onClick={() => removeImage(img.url)}
                          className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {img.revisedPrompt && img.revisedPrompt !== img.prompt && (
                        <div className="px-3 py-2 bg-muted/50 border-t">
                          <div className="text-[10px] text-muted-foreground font-medium mb-0.5">{t('u6.revisedPrompt')}</div>
                          <div className="text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-2">{img.revisedPrompt}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {t.rich('u6.noUnit5', { b: (c) => <strong>{c}</strong> })}
        </div>
      )}

      {/* Manual prompt */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wand2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          {t('u6.manualPrompt')}
        </div>
        <textarea value={manualPrompt} onChange={e => setManualPrompt(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none font-mono"
          placeholder={t('u6.manualPlaceholder')} />
        {manualError && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{manualError}
          </div>
        )}
        <button onClick={generateManual} disabled={manualGenerating || !manualPrompt.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {manualGenerating
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('u6.generatingShort')}</>
            : <><Sparkles className="h-3.5 w-3.5" />{t('u6.genWithModel', { model: modelInfo.name })}</>}
        </button>
        {images.filter(i => !scripts.find(s => s.id === i.scriptId)).length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {images.filter(i => !scripts.find(s => s.id === i.scriptId)).map(img => (
              <div key={img.url} className="relative rounded-xl overflow-hidden border">
                <img src={img.url} alt="generated" className="w-full object-cover aspect-square" />
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <a href={img.url} download="generated.png" target="_blank" rel="noreferrer"
                    className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80">
                    <Download className="h-2.5 w-2.5" />
                  </a>
                  <button onClick={() => removeImage(img.url)} className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium">
            {t('u6.successHint', { n: images.length })}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Unit 7: 影片腳本 ─────────────────────────────────────────────────────────

interface VideoScript {
  id: number
  content: string
}

interface Unit7Data {
  count?: number
  duration?: string
  videoTypes?: string[]
  platforms?: string[]
  scripts?: VideoScript[]
  userInstructions?: string
}

const VIDEO_PLATFORMS: { id: string; label: string }[] = [
  { id: 'instagram_reels', label: 'IG Reels' },
  { id: 'facebook_reels',  label: 'FB Reels' },
  { id: 'youtube_shorts',  label: 'YouTube Shorts' },
  { id: 'tiktok',          label: 'TikTok' },
  { id: 'youtube',         label: '' },
]

const VIDEO_TYPES: { id: string }[] = [
  { id: 'short_video' }, { id: 'ad' }, { id: 'tutorial' }, { id: 'testimonial' }, { id: 'brand_story' },
]

const DURATION_OPTIONS = [
  { value: '5',  hint: 'KLING' },
  { value: '10', hint: 'KLING' },
  { value: '25', hint: 'Google VEO3' },
  { value: '60', hint: 'SORA' },
]

function Unit7VideoScript({
  campaignId: _campaignId,
  savedData,
  unit1Data,
  unit2Data,
  unit3Data,
  unit4Data,
  unit5Data,
  unit6Data,
  driveFolderId,
  driveFolderName,
  drivePickedImage,
  onDriveFolderChange,
  onDriveImagePicked,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit7Data
  unit1Data?: { summary?: string; language?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  unit4Data?: Unit4Data
  unit5Data?: Unit5Data
  unit6Data?: Unit6Data
  driveFolderId?: string
  driveFolderName?: string
  drivePickedImage?: DrivePickedImage | null
  onDriveFolderChange: (id: string, name: string) => void
  onDriveImagePicked: (img: DrivePickedImage | null) => void
  onDone: (data: Unit7Data) => void
}) {
  const language = unit1Data?.language ?? 'zh-TW'
  const [count, setCount] = useState(savedData?.count ?? 1)
  const [duration, setDuration] = useState(savedData?.duration ?? '10')
  const [videoTypes, setVideoTypes] = useState<string[]>(savedData?.videoTypes ?? ['short_video'])
  const [platforms, setPlatforms] = useState<string[]>(savedData?.platforms ?? ['instagram_reels', 'tiktok'])
  const [instructions, setInstructions] = useState(savedData?.userInstructions ?? '')
  const [feedback, setFeedback] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit7Data | null>(savedData?.scripts?.length ? savedData : null)
  const [activeScript, setActiveScript] = useState(1)
  const [useRefImage, setUseRefImage] = useState(false)
  const [refImageSource, setRefImageSource] = useState<'drive' | 'unit6'>('drive')
  const [selectedUnit6ImageUrl, setSelectedUnit6ImageUrl] = useState('')
  const t = useTranslations('MA')
  const platformLabel = (id: string, label: string) => label || (t.has(`u7.platform.${id}`) ? t(`u7.platform.${id}`) : id)

  const unit6Images = unit6Data?.images ?? []

  const toggleType = (id: string) =>
    setVideoTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const togglePlatform = (id: string) =>
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const getRefImage = async (): Promise<{ base64: string; mimeType: string; name: string } | undefined> => {
    if (!useRefImage) return undefined
    if (refImageSource === 'drive' && drivePickedImage) {
      return { base64: drivePickedImage.dataUrl.split(',')[1], mimeType: drivePickedImage.mimeType, name: drivePickedImage.name }
    }
    if (refImageSource === 'unit6' && selectedUnit6ImageUrl) {
      try {
        const r = await fetch(selectedUnit6ImageUrl)
        const blob = await r.blob()
        const base64 = await new Promise<string>(resolve => {
          const reader = new FileReader()
          reader.onloadend = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
        return { base64, mimeType: blob.type || 'image/png', name: 'unit6-image.png' }
      } catch { return undefined }
    }
    return undefined
  }

  const run = async (fb?: string) => {
    if (videoTypes.length === 0) { setError(t('u7.errTypes')); return }
    if (platforms.length === 0) { setError(t('u7.errPlatforms')); return }
    setRunning(true); setError('')
    const refImg = await getRefImage()
    try {
      const res = await fetch('/api/marketing/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count, duration, videoTypes, platforms,
          userInstructions: instructions,
          companyData: unit2Data ?? {},
          analysisData: unit3Data ?? {},
          copyData: unit4Data ?? {},
          imageScripts: unit5Data ?? {},
          collectedSummary: unit1Data?.summary ?? '',
          feedback: fb ?? '',
          language,
          ...(refImg ? { referenceImage: refImg } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit7Data = { count, duration, videoTypes, platforms, scripts: data.scripts, userInstructions: instructions }
      setResult(out)
      setActiveScript(1)
      setFeedback('')
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Context status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: t('u4.ctxCollect'), ok: !!unit1Data?.summary },
          { label: t('u4.ctxCompany'), ok: !!unit2Data?.companyName },
          { label: t('u4.ctxAnalysis'), ok: !!unit3Data?.results },
          { label: t('u5.ctxCopy'), ok: !!unit4Data?.results },
          { label: t('u7.ctxImageScript'), ok: !!(unit5Data?.scripts?.length) },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Count */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u7.videoCount')}</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className="w-10 h-10 rounded-lg border text-sm font-medium transition-all"
              style={count === n
                ? { borderColor: 'var(--primary)', background: 'var(--primary)', color: 'white' }
                : { background: 'white' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u7.videoDuration')}</label>
        <div className="flex gap-2 flex-wrap">
          {DURATION_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDuration(opt.value)}
              className="flex flex-col items-center px-4 py-2 rounded-lg border text-xs transition-all"
              style={duration === opt.value
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              <span className="font-semibold">{t('u7.durSec', { s: opt.value })}</span>
              <span className="text-[10px] text-muted-foreground/70 mt-0.5">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Video type */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u7.videoType')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VIDEO_TYPES.map(vt => {
            const sel = videoTypes.includes(vt.id)
            return (
              <button key={vt.id} onClick={() => toggleType(vt.id)}
                className="flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                  : { borderColor: '#e5e7eb' }}>
                <div className={`w-4 h-4 rounded border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${sel ? 'border-0' : 'border-border'}`}
                  style={sel ? { background: 'var(--primary)' } : {}}>
                  {sel && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-medium">{t(`u7.vtype.${vt.id}.label`)}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">{t(`u7.vtype.${vt.id}.desc`)}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Platform */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u5.targetPlatforms')}</label>
        <div className="flex flex-wrap gap-2">
          {VIDEO_PLATFORMS.map(p => {
            const sel = platforms.includes(p.id)
            return (
              <button key={p.id} onClick={() => togglePlatform(p.id)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : {}}>
                {platformLabel(p.id, p.label)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Reference image */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {t('u7.refImgTitle')}
          </div>
          <button onClick={() => setUseRefImage(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all"
            style={useRefImage
              ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
              : { background: 'white' }}>
            {useRefImage ? t('u6.enabled') : t('u7.useRefImg')}
          </button>
        </div>
        {!useRefImage && (
          <p className="text-[10px] text-blue-500">{t('u7.refImgHint')}</p>
        )}
        {useRefImage && (
          <>
            {/* Source toggle */}
            <div className="flex gap-2">
              <button onClick={() => setRefImageSource('drive')}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={refImageSource === 'drive'
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : { background: 'white' }}>
                Google Drive
              </button>
              <button onClick={() => setRefImageSource('unit6')}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={refImageSource === 'unit6'
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : { background: 'white' }}>
                {t('u7.unit6Image')}
              </button>
            </div>
            {refImageSource === 'drive' && (
              <DriveImagePicker
                folderId={driveFolderId}
                folderName={driveFolderName}
                onFolderChange={onDriveFolderChange}
                onImagePicked={onDriveImagePicked}
                pickedImage={drivePickedImage ?? null}
                label={t('u7.refImgPickLabel')}
              />
            )}
            {refImageSource === 'unit6' && (
              unit6Images.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-blue-600">{t('u7.pickUnit6')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {unit6Images.map(img => (
                      <button key={img.url} onClick={() => setSelectedUnit6ImageUrl(img.url)}
                        className="relative rounded-lg overflow-hidden border-2 transition-all"
                        style={selectedUnit6ImageUrl === img.url ? { borderColor: 'var(--primary)' } : { borderColor: 'transparent' }}>
                        <img src={img.url} alt="unit6" className="w-16 h-16 object-cover" />
                        {selectedUnit6ImageUrl === img.url && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-blue-600">{t('u7.noUnit6Images')}</p>
              )
            )}
          </>
        )}
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {t('u5.specialRules')}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">{t('u7.optional')}</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder={t('u7.rulesPlaceholder')} />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {(() => {
        const refReady = !useRefImage
          || (refImageSource === 'drive' && !!drivePickedImage)
          || (refImageSource === 'unit6' && !!selectedUnit6ImageUrl)
        const hasRef = useRefImage && refReady
        return (
          <button onClick={() => run()} disabled={running || !refReady}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'var(--primary)' }}>
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u5.generatingScript')}</>
              : <><Film className="h-4 w-4" />{hasRef ? t('u7.genWithRef') : t('u7.genScript')}</>}
          </button>
        )
      })()}

      {/* Results */}
      {result && result.scripts && result.scripts.length > 0 && (
        <div className="space-y-3">
          {/* Script tabs */}
          <div className="flex gap-1.5 flex-wrap border-b pb-2">
            {result.scripts.map(s => (
              <button key={s.id} onClick={() => setActiveScript(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeScript === s.id ? 'bg-foreground text-background' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}>
                {t('u7.videoN', { n: s.id })}
              </button>
            ))}
            <button onClick={() => run()} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> {t('u4.regenerate')}
            </button>
          </div>

          {/* Active script */}
          {result.scripts.find(s => s.id === activeScript) && (
            <div className="p-5 rounded-xl bg-muted/50 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('u7.scriptTitle', { n: activeScript, dur: result.duration ?? '' })}
                </span>
                <span className="text-[10px] text-muted-foreground/70 bg-white border rounded-full px-2 py-0.5">
                  {t('u7.totalVideos', { n: result.scripts.length })}
                </span>
              </div>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-[600px] overflow-y-auto">
                {result.scripts.find(s => s.id === activeScript)?.content}
              </pre>
            </div>
          )}

          {/* Feedback */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="text-xs font-semibold text-amber-800">{t('u5.feedbackTitle')}</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder={t('u7.feedbackPlaceholder')}
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {t('u4.regenAll')}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1">💡 {t('u5.tipTitle')}</div>
            <div className="text-xs text-blue-600">
              {t.rich('u7.tipBody', { b: (c) => <strong>{c}</strong> })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 8: 影片產出 ─────────────────────────────────────────────────────────

type VideoModel = 'kling-standard' | 'kling-pro' | 'kling-img2video' | 'veo3' | 'veo3-img2video' | 'sora' | 'sora-img2video'
type VideoDuration = '5' | '10' | '25' | '60'

interface GeneratedVideo {
  scriptId: number
  url: string
  requestId: string
  model: VideoModel
  generatedAt: string
}

interface VideoJob {
  scriptId: number
  requestId: string
  model: VideoModel
  status: 'processing' | 'completed' | 'failed'
  error?: string
}

interface Unit8Data {
  videos?: GeneratedVideo[]
}

const DURATION_CARDS: { duration: VideoDuration; provider: string }[] = [
  { duration: '5',  provider: 'KLING' },
  { duration: '10', provider: 'KLING' },
  { duration: '25', provider: 'Google VEO3' },
  { duration: '60', provider: 'SORA' },
]

function resolveModel(duration: VideoDuration, klingQuality: 'standard' | 'pro', useImg2Video: boolean): VideoModel {
  if (duration === '5' || duration === '10') {
    if (useImg2Video) return 'kling-img2video'
    return klingQuality === 'pro' ? 'kling-pro' : 'kling-standard'
  }
  if (duration === '25') return useImg2Video ? 'veo3-img2video' : 'veo3'
  return useImg2Video ? 'sora-img2video' : 'sora'
}

const VIDEO_ASPECT_OPTIONS = [
  { value: '16:9', hint: 'YouTube/FB' },
  { value: '9:16', hint: 'Reels/TikTok' },
  { value: '1:1',  hint: 'IG' },
]

// Strip markdown bold/italic markers
function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}

// Extract video prompt from script content — uses full storyboard for comprehensive scene description
function extractVideoPrompt(content: string): string {
  if (!content?.trim()) return ''

  // 1. Extract entire 分鏡腳本 section (preferred — gives model full visual context)
  const storyboardMatch = content.match(/分鏡腳本[\s\S]*?\n([\s\S]+?)(?:===|$)/i)
  if (storyboardMatch?.[1]) {
    const storyboard = storyboardMatch[1]
      .split('\n')
      .map(l => stripMd(l).trim())
      .filter(l => l.length > 3 && !l.match(/^={3,}/) && !l.match(/^\s*\|[-|]+\|?\s*$/))
      .join('。')
    if (storyboard.length > 30) return storyboard.slice(0, 2000)
  }

  // 2. All time-coded storyboard lines — broad regex covers [0-3秒] [0~3s] [00:00-00:03] [第1場] etc.
  const timeLines = [...content.matchAll(/\[[\d:：\-–~～\s秒sS第場景幕段一二三四五六七八九十百]+\]\s*([^\n|]+)/g)]
  const timeParts = timeLines.map(m => stripMd(m[1].split('|')[0])).filter(d => d.length > 5)
  if (timeParts.length > 0) {
    const hookMatch = content.match(/開頭\s*Hook[^）\n]*[）\n][^]*?畫面[：:]\s*(.+?)(?:\n|$)/i)
    const hook = hookMatch?.[1] ? [stripMd(hookMatch[1]).slice(0, 100)] : []
    return [...hook, ...timeParts].join('。').slice(0, 2000)
  }

  // 3. All 畫面: descriptions
  const sceneMatches = [...content.matchAll(/畫面[：:]\s*(.+?)(?:\n|$)/gi)]
  const scenes = sceneMatches.map(m => stripMd(m[1])).filter(Boolean)
  if (scenes.length > 0) return scenes.join('。').slice(0, 2000)

  // 4. 影片標題 fallback
  const titleMatch = content.match(/影片標題[：:]\s*(.+?)(?:\n|$)/i)
  if (titleMatch?.[1]?.trim()) return stripMd(titleMatch[1])

  // 5. Last resort: first meaningful non-header lines
  const lines = content.split('\n')
    .map(l => stripMd(l))
    .filter(l => l.length > 10 && !l.startsWith('===') && !l.startsWith('#') && !l.startsWith('['))
  return lines.slice(0, 5).join('。') || stripMd(content.slice(0, 500))
}

function Unit8VideoGenerate({
  campaignId: _campaignId,
  savedData,
  unit6Data,
  unit7Data,
  drivePickedImage,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit8Data
  unit6Data?: Unit6Data
  unit7Data?: Unit7Data
  drivePickedImage?: DrivePickedImage | null
  onDone: (data: Unit8Data) => void
}) {
  const scripts = unit7Data?.scripts ?? []
  const generatedImages = unit6Data?.images ?? []
  const t = useTranslations('MA')
  const locale = useLocale()
  const modelLabel = (m: VideoModel) => t(`u8.model.${m}`)
  const genLabel = (m: VideoModel) => t(`u8.gen.${m.startsWith('kling') ? 'kling' : m.startsWith('veo3') ? 'veo3' : 'sora'}`)

  const [duration, setDuration] = useState<VideoDuration>('5')
  const [klingQuality, setKlingQuality] = useState<'standard' | 'pro'>('standard')
  const [useImg2Video, setUseImg2Video] = useState(false)
  const model = resolveModel(duration, klingQuality, useImg2Video)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [prompts, setPrompts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    scripts.forEach(s => { init[s.id] = extractVideoPrompt(s.content) })
    return init
  })
  // Track which prompts the user has manually edited
  const [userEditedPrompts, setUserEditedPrompts] = useState<Set<number>>(new Set())

  // Re-extract prompts when Unit 7 scripts are loaded/updated (skip user-edited ones)
  useEffect(() => {
    setPrompts(prev => {
      const next = { ...prev }
      scripts.forEach(s => {
        if (!userEditedPrompts.has(s.id)) {
          next[s.id] = extractVideoPrompt(s.content)
        }
      })
      return next
    })
  }, [scripts, userEditedPrompts])
  const [selectedImage, setSelectedImage] = useState<string>('')
  // 'unit6' | 'drive' | '' — source for img2video
  const [img2VideoSource, setImg2VideoSource] = useState<'unit6' | 'drive'>('unit6')
  const [manualPrompt, setManualPrompt] = useState('')

  const [jobs, setJobs] = useState<Record<number, VideoJob>>({})
  const [videos, setVideos] = useState<GeneratedVideo[]>(savedData?.videos ?? [])
  const [manualJob, setManualJob] = useState<VideoJob | null>(null)

  const hasUnit7 = scripts.length > 0
  const hasUnit6Images = generatedImages.length > 0

  // Polling
  const pollJob = useCallback(async (job: VideoJob, key: number | 'manual') => {
    try {
      const res = await fetch(
        `/api/marketing/generate-video?requestId=${job.requestId}&model=${job.model}&scriptId=${job.scriptId}`
      )
      const data = await res.json()

      if (data.status === 'processing') return // keep polling

      if (data.status === 'completed') {
        const vid: GeneratedVideo = { scriptId: job.scriptId, url: data.url, requestId: job.requestId, model: job.model, generatedAt: data.generatedAt }
        setVideos(prev => {
          const next = [...prev.filter(v => v.scriptId !== job.scriptId), vid]
          onDone({ videos: next }); return next
        })
        if (key === 'manual') {
          setManualJob(prev => prev ? { ...prev, status: 'completed' } : null)
        } else {
          setJobs(prev => ({ ...prev, [key]: { ...job, status: 'completed' } }))
        }
      } else {
        if (key === 'manual') setManualJob(prev => prev ? { ...prev, status: 'failed', error: data.error } : null)
        else setJobs(prev => ({ ...prev, [key]: { ...job, status: 'failed', error: data.error } }))
      }
    } catch { /* retry next tick */ }
  }, [onDone])

  // Poll processing jobs every 6 seconds
  useEffect(() => {
    const processingJobs = Object.entries(jobs).filter(([, j]) => j.status === 'processing')
    if (processingJobs.length === 0 && manualJob?.status !== 'processing') return
    const interval = setInterval(() => {
      processingJobs.forEach(([key, job]) => pollJob(job, Number(key)))
      if (manualJob?.status === 'processing') pollJob(manualJob, 'manual')
    }, 6000)
    return () => clearInterval(interval)
  }, [jobs, manualJob, pollJob])

  const getImg2VideoUrl = () => {
    if (!useImg2Video) return undefined
    if (img2VideoSource === 'drive' && drivePickedImage) return drivePickedImage.publicUrl
    if (img2VideoSource === 'unit6' && selectedImage) return selectedImage
    return undefined
  }

  const submitJob = async (scriptId: number) => {
    const prompt = prompts[scriptId]?.trim()
    if (!prompt) {
      setJobs(prev => ({ ...prev, [scriptId]: { scriptId, requestId: '', model, status: 'failed', error: t('u8.promptEmpty') } }))
      return
    }
    const payload: Record<string, unknown> = { prompt, scriptId, model, duration, aspectRatio }
    const imgUrl = getImg2VideoUrl()
    if (imgUrl) payload.imageUrl = imgUrl

    try {
      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const job: VideoJob = { scriptId, requestId: data.requestId, model, status: 'processing' }
      setJobs(prev => ({ ...prev, [scriptId]: job }))
    } catch (e) {
      setJobs(prev => ({ ...prev, [scriptId]: { scriptId, requestId: '', model, status: 'failed', error: String(e) } }))
    }
  }

  const submitManual = async () => {
    if (!manualPrompt.trim()) return
    const payload: Record<string, unknown> = { prompt: manualPrompt.trim(), scriptId: 0, model, duration, aspectRatio }
    const imgUrl = getImg2VideoUrl()
    if (imgUrl) payload.imageUrl = imgUrl
    try {
      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setManualJob({ scriptId: 0, requestId: data.requestId, model, status: 'processing' })
    } catch (e) {
      setManualJob({ scriptId: 0, requestId: '', model, status: 'failed', error: String(e) })
    }
  }

  const removeVideo = (url: string) =>
    setVideos(prev => { const next = prev.filter(v => v.url !== url); onDone({ videos: next }); return next })

  return (
    <div className="space-y-6">

      {/* Duration / Provider selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">{t('u8.selectDuration')}</label>
        <div className="grid grid-cols-4 gap-3">
          {DURATION_CARDS.map(card => (
            <button key={card.duration} onClick={() => { setDuration(card.duration); setUseImg2Video(false) }}
              className="relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
              style={duration === card.duration
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                : { borderColor: '#e5e7eb', background: 'white' }}>
              <span className="text-base font-bold text-foreground">{t('u7.durSec', { s: card.duration })}</span>
              <span className="text-[11px] font-semibold mt-1"
                style={{ color: duration === card.duration ? 'var(--primary)' : '#6b7280' }}>
                {card.provider}
              </span>
              <span className="text-[10px] text-muted-foreground/70 mt-0.5">{t(`u8.durHint.${card.duration}`)}</span>
            </button>
          ))}
        </div>

        {/* KLING quality sub-selector */}
        {(duration === '5' || duration === '10') && !useImg2Video && (
          <div className="mt-3 flex gap-2">
            {(['standard', 'pro'] as const).map(q => (
              <button key={q} onClick={() => setKlingQuality(q)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={klingQuality === q
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : { background: 'white' }}>
                {q === 'standard' ? t('u8.klingStandard') : t('u8.klingPro')}
              </button>
            ))}
          </div>
        )}

        {/* Img2Video toggle */}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setUseImg2Video(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={useImg2Video
              ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
              : { background: 'white' }}>
            <ImageIcon className="h-3.5 w-3.5" />
            {t('u8.img2video')}
          </button>
          <span className="text-[10px] text-muted-foreground/70">{t('u8.img2videoHint')}</span>
        </div>

        <div className="mt-2 text-[10px] text-muted-foreground/70">
          {t('u8.currentModel')}<span className="font-semibold text-muted-foreground">{modelLabel(model)}</span>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 rounded-xl bg-muted/50 border space-y-4">
        <div className="text-xs font-semibold text-muted-foreground">{t('u8.videoSettings')}</div>
        <div className="flex flex-wrap gap-6">
          {/* Aspect ratio */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">{t('u8.aspectRatio')}</div>
            <div className="flex gap-2">
              {VIDEO_ASPECT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setAspectRatio(opt.value)}
                  className="flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all"
                  style={aspectRatio === opt.value
                    ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                    : { background: 'white' }}>
                  <span className="font-medium">{t(`u8.aspect.${opt.value}`)}</span>
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Image selector (img2video) */}
      {useImg2Video && (
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 space-y-3">
          <div className="text-xs font-semibold text-blue-800">{t('u8.selectSourceImg')}</div>
          {/* Source toggle */}
          <div className="flex gap-2">
            <button onClick={() => setImg2VideoSource('unit6')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={img2VideoSource === 'unit6'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              {t('u7.unit6Image')}
            </button>
            <button onClick={() => setImg2VideoSource('drive')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={img2VideoSource === 'drive'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              {t('u8.driveImage')}
            </button>
          </div>
          {img2VideoSource === 'unit6' && (
            hasUnit6Images ? (
              <div className="flex gap-2 flex-wrap">
                {generatedImages.map(img => (
                  <button key={img.url} onClick={() => setSelectedImage(img.url)}
                    className="relative rounded-lg overflow-hidden border-2 transition-all"
                    style={selectedImage === img.url ? { borderColor: 'var(--primary)' } : { borderColor: 'transparent' }}>
                    <img src={img.url} alt="" className="w-16 h-16 object-cover" />
                    {selectedImage === img.url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-600">{t('u8.noUnit6Images')}</p>
            )
          )}
          {img2VideoSource === 'drive' && (
            drivePickedImage ? (
              <div className="flex items-center gap-3">
                <img src={drivePickedImage.dataUrl} alt={drivePickedImage.name} className="w-16 h-16 object-cover rounded-lg border" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-800 truncate">{drivePickedImage.name}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{t('u8.driveChosen')}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-600">{t('u8.noDriveImg')}</p>
            )
          )}
        </div>
      )}

      {/* From Unit 7 scripts */}
      {hasUnit7 ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">{t('u8.fromScripts', { n: scripts.length })}</div>
          {scripts.map(s => {
            const job = jobs[s.id]
            const vid = videos.find(v => v.scriptId === s.id)
            const isProcessing = job?.status === 'processing'
            const isFailed = job?.status === 'failed'
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{t('u7.videoN', { n: s.id })}</span>
                  {vid && <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">{t('u6.generated')}</span>}
                  {isProcessing && <span className="ml-auto text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />{t('u8.processing')}</span>}
                  {isFailed && <span className="ml-auto text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">{t('u8.failed')}</span>}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('u8.videoPrompt')} <span className="text-muted-foreground/70 font-normal">{t('u6.editable')}</span></label>
                    <textarea value={prompts[s.id] ?? ''} onChange={e => {
                        setUserEditedPrompts(prev => new Set(prev).add(s.id))
                        setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))
                      }}
                      rows={3} className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none"
                      placeholder={t('u8.videoPromptPlaceholder')} />
                  </div>
                  {isFailed && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{job?.error}
                    </div>
                  )}
                  <button onClick={() => submitJob(s.id)} disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-opacity"
                    style={{ background: 'var(--primary)' }}>
                    {isProcessing
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{genLabel(model)}</>
                      : <><Sparkles className="h-3.5 w-3.5" />{vid ? t('u4.regenerate') : t('u8.genVideo')}</>}
                  </button>
                  {vid && (
                    <div className="rounded-xl overflow-hidden border bg-black">
                      <video src={vid.url} controls className="w-full max-h-72" />
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-t">
                        <span className="text-[10px] text-muted-foreground/70 flex-1">{modelLabel(vid.model)} · {new Date(vid.generatedAt).toLocaleString(locale)}</span>
                        <a href={vid.url} download={`video-${s.id}.mp4`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-foreground text-[10px] hover:bg-muted">
                          <Download className="h-3 w-3" /> {t('u6.download')}
                        </a>
                        <button onClick={() => removeVideo(vid.url)} className="p-1 rounded-lg text-muted-foreground/70 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {t.rich('u8.noUnit7', { b: (c) => <strong>{c}</strong> })}
        </div>
      )}

      {/* Manual prompt */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wand2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          {t('u6.manualPrompt')}
        </div>
        <textarea value={manualPrompt} onChange={e => setManualPrompt(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none"
          placeholder={t('u8.manualPlaceholder')} />
        {manualJob?.status === 'failed' && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{manualJob.error}
          </div>
        )}
        <button onClick={submitManual} disabled={manualJob?.status === 'processing' || !manualPrompt.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {manualJob?.status === 'processing'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{genLabel(model)}</>
            : <><Sparkles className="h-3.5 w-3.5" />{t('u8.genVideo')}</>}
        </button>
        {(() => {
          const manualVid = videos.find(v => v.scriptId === 0)
          return manualVid ? (
            <div className="rounded-xl overflow-hidden border bg-black mt-3">
              <video src={manualVid.url} controls autoPlay className="w-full max-h-72" />
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-t">
                <span className="text-[10px] text-muted-foreground/70 flex-1">
                  {modelLabel(manualVid.model)} · {new Date(manualVid.generatedAt).toLocaleString(locale)}
                </span>
                <a href={manualVid.url} download="video.mp4" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-foreground text-[10px] hover:bg-muted">
                  <Download className="h-3 w-3" /> {t('u6.download')}
                </a>
                <button onClick={() => removeVideo(manualVid.url)} className="p-1 rounded-lg text-muted-foreground/70 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null
        })()}
      </div>

      {/* Notice */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
        {t.rich('u8.notice', { b: (c) => <strong>{c}</strong> })}
      </div>

      {videos.length > 0 && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium">{t('u8.successHint', { n: videos.length })}</span>
        </div>
      )}
    </div>
  )
}

// ─── Unit 9: 上傳平台 ─────────────────────────────────────────────────────────

interface UploadResult {
  platform: string
  ok: boolean
  postId?: string
  error?: string
}

interface Unit9Data {
  lastUpload?: {
    platforms: string[]
    results: UploadResult[]
    uploadedAt: string
  }
}

const IMAGE_UPLOAD_PLATFORMS = [
  { id: 'Facebook',   label: 'Facebook',   icon: '📘' },
  { id: 'Instagram',  label: 'Instagram',  icon: '📸' },
  { id: 'Threads',    label: 'Threads',    icon: '🧵' },
  { id: 'LINE VOOM',  label: 'LINE VOOM',  icon: '💚' },
  { id: 'Zalo',       label: 'Zalo',       icon: '🟦' },
  { id: 'LinkedIn',   label: 'LinkedIn',   icon: '💼' },
  { id: 'Twitter/X',  label: 'Twitter/X',  icon: '🐦' },
]

const VIDEO_UPLOAD_PLATFORMS = [
  { id: 'FB Reels',       label: 'FB Reels',       icon: '🎬' },
  { id: 'IG Reels',       label: 'IG Reels',       icon: '🎥' },
  { id: 'YouTube Shorts', label: 'YouTube Shorts', icon: '▶️' },
  { id: 'TikTok',         label: 'TikTok',         icon: '🎵' },
]

function Unit9Upload({
  campaignId: _campaignId,
  savedData,
  unit4Data,
  unit6Data,
  unit8Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit9Data
  unit4Data?: Unit4Data
  unit6Data?: Unit6Data
  unit8Data?: Unit8Data
  onDone: (data: Unit9Data) => void
}) {
  const images = unit6Data?.images ?? []
  const videos = unit8Data?.videos ?? []
  const copyResults = unit4Data?.results ?? {}

  // Pick copy text: prefer FB post, fallback first available
  const defaultCopy = copyResults['facebook_post']
    ?? copyResults['instagram_caption']
    ?? Object.values(copyResults)[0]
    ?? ''

  const [selectedImagePlatforms, setSelectedImagePlatforms] = useState<string[]>([])
  const [selectedVideoPlatforms, setSelectedVideoPlatforms] = useState<string[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState(images[0]?.url ?? '')
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(videos[0]?.url ?? '')
  const [copyText, setCopyText] = useState(defaultCopy)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>(savedData?.lastUpload?.results ?? [])
  const [error, setError] = useState('')
  const t = useTranslations('MA')
  const locale = useLocale()

  const toggleImgPlatform = (id: string) =>
    setSelectedImagePlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleVidPlatform = (id: string) =>
    setSelectedVideoPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const allSelected = [...selectedImagePlatforms, ...selectedVideoPlatforms]
  const hasImages = images.length > 0
  const hasVideos = videos.length > 0

  const upload = async () => {
    if (allSelected.length === 0) { setError(t('u9.errPlatform')); return }
    if (!copyText.trim()) { setError(t('u9.errCopy')); return }
    setUploading(true); setError('')
    try {
      const res = await fetch('/api/marketing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: allSelected,
          imageUrls: selectedImageUrl ? [selectedImageUrl] : [],
          videoUrl: selectedVideoUrl,
          copyText: copyText.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
      const out: Unit9Data = {
        lastUpload: { platforms: allSelected, results: data.results, uploadedAt: new Date().toISOString() }
      }
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Assets status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: t('u9.imgCount', { n: images.length }), ok: hasImages },
          { label: t('u9.vidCount', { n: videos.length }), ok: hasVideos },
          { label: t('u9.copy'), ok: Object.keys(copyResults).length > 0 },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted/50 border-border text-muted-foreground/70'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label} {s.ok ? t('u9.ready') : t('u9.notGenerated')}
          </div>
        ))}
        <a href="/marketing-auto/platforms" target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs bg-muted/50 border-border text-muted-foreground hover:bg-muted/70 transition-colors">
          <Settings className="h-3.5 w-3.5" /> {t('u9.platformSettings')}
        </a>
      </div>

      {/* Image platform selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u9.imgPlatforms')}</label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_UPLOAD_PLATFORMS.map(p => {
            const sel = selectedImagePlatforms.includes(p.id)
            return (
              <button key={p.id} onClick={() => toggleImgPlatform(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : { borderColor: '#e5e7eb' }}>
                <span>{p.icon}</span>{p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Video platform selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">{t('u9.vidPlatforms')}</label>
        <div className="flex flex-wrap gap-2">
          {VIDEO_UPLOAD_PLATFORMS.map(p => {
            const sel = selectedVideoPlatforms.includes(p.id)
            return (
              <button key={p.id} onClick={() => toggleVidPlatform(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : { borderColor: '#e5e7eb' }}>
                <span>{p.icon}</span>{p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Image picker */}
      {selectedImagePlatforms.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">{t('u9.pickImage')}</label>
          {hasImages ? (
            <div className="flex gap-2 flex-wrap">
              {images.map(img => (
                <button key={img.url} onClick={() => setSelectedImageUrl(img.url)}
                  className="relative rounded-xl overflow-hidden border-2 transition-all"
                  style={selectedImageUrl === img.url ? { borderColor: 'var(--primary)' } : { borderColor: 'transparent' }}>
                  <img src={img.url} alt="" className="w-16 h-16 object-cover" />
                  {selectedImageUrl === img.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70">{t('u9.noImages')}</p>
          )}
        </div>
      )}

      {/* Video picker */}
      {selectedVideoPlatforms.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">{t('u9.pickVideo')}</label>
          {hasVideos ? (
            <div className="flex gap-3 flex-wrap">
              {videos.map(vid => (
                <button key={vid.url} onClick={() => setSelectedVideoUrl(vid.url)}
                  className="relative rounded-xl overflow-hidden border-2 transition-all"
                  style={selectedVideoUrl === vid.url ? { borderColor: 'var(--primary)' } : { borderColor: '#e5e7eb' }}>
                  <video src={vid.url} className="w-24 h-16 object-cover" muted />
                  {selectedVideoUrl === vid.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70">{t('u9.noVideos')}</p>
          )}
        </div>
      )}

      {/* Copy text */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {t('u9.postCopy')}
          {Object.keys(copyResults).length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground/70">{t('u9.quickLoad')}</span>
          )}
          {Object.entries(copyResults).slice(0, 4).map(([k, v]) => {
            const labels: Record<string, string> = {
              facebook_post: 'FB', instagram_caption: 'IG', threads_post: 'Threads',
              line_message: 'LINE', twitter_post: 'Twitter', linkedin_post: 'LinkedIn',
              anchor_script: t('u9.anchorTag'),
            }
            return (
              <button key={k} onClick={() => setCopyText(v as string)}
                className="ml-1 text-xs px-2 py-0.5 rounded-full border hover:bg-muted/70 transition-colors"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {labels[k] ?? k}
              </button>
            )
          })}
        </label>
        <textarea value={copyText} onChange={e => setCopyText(e.target.value)} rows={6}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder={t('u9.copyPlaceholder')} />
        <div className="text-[10px] text-muted-foreground/70 mt-1">{t('u9.charCount', { n: copyText.length })}</div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={upload} disabled={uploading || allSelected.length === 0}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {uploading
          ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u9.uploading')}</>
          : <><Upload className="h-4 w-4" />{t('u9.publishTo', { n: allSelected.length })}</>}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">{t('u9.uploadResult')}</div>
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.platform}
                className={`flex items-start gap-3 p-3 rounded-xl border ${r.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {r.ok
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {r.platform} — {r.ok ? t('u9.publishOk') : t('u9.publishFail')}
                  </div>
                  {r.postId && <div className="text-xs text-green-600 mt-0.5">Post ID: {r.postId}</div>}
                  {r.error && (
                    <div className="text-xs text-red-600 mt-0.5">
                      {r.error}
                      {/expired|invalid.*token|token.*invalid|session.*expired/i.test(r.error) && (
                        <a href="/settings" className="ml-2 underline font-semibold text-red-700 hover:text-red-900">
                          {t('u9.updateToken')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground/70">
            {t('u9.successCount', { ok: results.filter(r => r.ok).length, total: results.length })} · {savedData?.lastUpload?.uploadedAt ? new Date(savedData.lastUpload.uploadedAt).toLocaleString(locale) : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 10: 潛在客戶行銷 ──────────────────────────────────────────────────

interface CallRecord {
  phone: string
  ok: boolean
  id?: string
  error?: string
}

interface EmailRecord {
  email: string
  group: string
  ok: boolean
  id?: string
  error?: string
}

interface EmailTemplate {
  id: string
  name: string      // e.g. "美妝博主腳本"
  subject: string
  body: string
}

interface EmailRule {
  id: string
  name: string      // 分類名稱 / AI 分類標籤，e.g. "美妝博主"
  desc: string      // AI 分類依據描述
  templateId: string // 對應哪個 EmailTemplate
}

interface Unit10Data {
  // Phone
  script?: string
  voiceId?: string
  birdCallerId?: string
  phoneInput?: string
  lastBatch?: {
    total: number; success: number; results: CallRecord[]
    audioUrl?: string; calledAt: string
  }
  // Email
  emailTemplates?: EmailTemplate[]
  emailRules?: EmailRule[]
  emailInput?: string
  emailRecipients?: { email: string; group: string }[]
  fromName?: string
  fromEmail?: string
  lastEmailBatch?: {
    total: number; success: number; results: EmailRecord[]; sentAt: string
  }
}

const ELEVEN_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',     descKey: 'mlFemale' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',      descKey: 'mlMale' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', descKey: 'mlFemale' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',    descKey: 'brMale' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',      descKey: 'mlFemale' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',   descKey: 'usFemale' },
]

function Unit10ProspectMarketing({
  campaignId: _campaignId,
  savedData,
  unit2Data,
  unit4Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit10Data
  unit2Data?: Unit2Data
  unit4Data?: Unit4Data
  onDone: (data: Unit10Data) => void
}) {
  const t = useTranslations('MA')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone')

  // ── Phone tab state ──────────────────────────────────────────────────────
  const [script, setScript] = useState(savedData?.script ?? '')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptLang, setScriptLang] = useState('繁體中文')

  const [voiceId, setVoiceId] = useState(savedData?.voiceId ?? 'EXAVITQu4vr4xnSDxMaL')
  const [birdCallerId, setBirdCallerId] = useState(savedData?.birdCallerId ?? '')

  const [phoneInput, setPhoneInput] = useState(savedData?.phoneInput ?? '')
  const [phones, setPhones] = useState<string[]>(() => {
    const raw = savedData?.phoneInput ?? ''
    return raw.split(/[\n,;，；\s]+/).map(p => p.trim()).filter(p => p.length >= 8)
  })

  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')

  const [calling, setCalling] = useState(false)
  const [callError, setCallError] = useState('')
  const [results, setResults] = useState<CallRecord[]>(savedData?.lastBatch?.results ?? [])

  // ── Email tab state ──────────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState(savedData?.emailInput ?? '')
  const [emailRecipients, setEmailRecipients] = useState<{ email: string; group: string }[]>(savedData?.emailRecipients ?? [])
  const [classifying, setClassifying] = useState(false)
  // 寄件人統一由系統設定，前端不再提供欄位；保留值供持久化相容
  const fromName = savedData?.fromName ?? t('u10.defMarketingTeam')
  const fromEmail = savedData?.fromEmail ?? ''
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(
    savedData?.emailTemplates ?? [
      { id: 'etpl-1', name: t('u10.defScript'), subject: '', body: '' },
    ]
  )
  const [emailRules, setEmailRules] = useState<EmailRule[]>(
    savedData?.emailRules ?? [
      { id: 'erule-1', name: t('u10.defGeneralCustomer'), desc: t('u10.defGeneralDesc'), templateId: 'etpl-1' },
    ]
  )
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [emailResults, setEmailResults] = useState<EmailRecord[]>(savedData?.lastEmailBatch?.results ?? [])

  // ── Persistence: auto-save on change ─────────────────────────────────────
  const unit10InitRef = useRef(false)
  useEffect(() => {
    if (!unit10InitRef.current) { unit10InitRef.current = true; return }
    onDone({
      ...savedData,
      script, voiceId, birdCallerId, phoneInput,
      emailTemplates, emailRules, emailInput, emailRecipients, fromName, fromEmail,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, voiceId, birdCallerId, phoneInput, emailTemplates, emailRules, emailInput, emailRecipients, fromName, fromEmail])

  const parsePhones = (raw: string): string[] =>
    raw.split(/[\n,;，；\s]+/).map(p => p.trim()).filter(p => p.length >= 8)

  const handlePhoneInput = (val: string) => {
    setPhoneInput(val)
    setPhones(parsePhones(val))
  }

  // ── Email template CRUD ──────────────────────────────────────────────────────
  const addEmailTemplate = () => setEmailTemplates(prev => [...prev, {
    id: `etpl-${Date.now()}`, name: t('u10.scriptN', { n: prev.length + 1 }), subject: '', body: '',
  }])
  const updateEmailTemplate = (id: string, patch: Partial<EmailTemplate>) =>
    setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  const removeEmailTemplate = (id: string) =>
    setEmailTemplates(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev)

  // ── Email rule CRUD ──────────────────────────────────────────────────────────
  const addEmailRule = () => setEmailRules(prev => [...prev, {
    id: `erule-${Date.now()}`,
    name: t('u10.categoryN', { n: prev.length + 1 }),
    desc: '',
    templateId: emailTemplates[0]?.id ?? '',
  }])
  const updateEmailRule = (id: string, patch: Partial<EmailRule>) =>
    setEmailRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  const removeEmailRule = (id: string) =>
    setEmailRules(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)

  // ── Email helpers ────────────────────────────────────────────────────────────
  const parseEmails = (raw: string) => {
    return raw.split('\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) return null
      const [email] = trimmed.split(/[\s|,]/)
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
      return { email, group: emailRules[0]?.name ?? t('u10.groupDefault') }
    }).filter(Boolean) as { email: string; group: string }[]
  }

  const handleEmailInput = (val: string) => {
    setEmailInput(val)
    setEmailRecipients(parseEmails(val))
  }

  const classifyEmails = async () => {
    if (emailRecipients.length === 0) return
    if (emailRules.length === 0) { setSendError(t('u10.errNeedRule')); return }
    setClassifying(true)
    try {
      const categoryList = emailRules
        .map(r => `"${r.name}"${r.desc ? `（${r.desc}）` : ''}`)
        .join('、')
      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: ['line_message'],
          userInstructions: `請分析以下 Email 清單，根據 domain、命名或其他線索，將每個收件人歸類至以下分類之一：${categoryList}。
回傳 JSON 陣列，格式：[{"email":"xxx","group":"分類名稱"}]。group 值必須完全符合上面定義的分類名稱。只回傳 JSON。

Email 清單：
${emailRecipients.map(r => r.email).join('\n')}`,
          companyData: {},
          collectedSummary: '',
        }),
      })
      const data = await res.json()
      const raw: string = data?.results?.line_message ?? ''
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const classified: { email: string; group: string }[] = JSON.parse(match[0])
        setEmailRecipients(prev => prev.map(r => {
          const found = classified.find(c => c.email === r.email)
          return found ? { ...r, group: found.group } : r
        }))
      }
    } catch { /* silent */ }
    finally { setClassifying(false) }
  }

  const sendEmails = async () => {
    if (emailRecipients.length === 0) { setSendError(t('u10.errNeedRecipients')); return }
    const hasTemplate = emailTemplates.some(tpl => tpl.subject && tpl.body)
    if (!hasTemplate) { setSendError(t('u10.errNeedTemplate')); return }
    setSending(true); setSendError(''); setEmailResults([])
    try {
      // Build groups map: rule.name → template subject/body
      const groups: Record<string, { subject: string; body: string }> = {}
      emailRules.forEach(rule => {
        const tpl = emailTemplates.find(t => t.id === rule.templateId)
        if (tpl) groups[rule.name] = { subject: tpl.subject, body: tpl.body }
      })
      const res = await fetch('/api/marketing/email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailRecipients,
          groups,
          defaultSubject: unit4Data?.results?.email_subject ?? '行銷訊息',
          defaultBody: unit4Data?.results?.email_body ?? '',
          fromName,
          fromEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('u10.sendFailed'))
      setEmailResults(data.results)
      onDone({ ...savedData, lastEmailBatch: { total: data.total, success: data.success, results: data.results, sentAt: new Date().toISOString() } })
    } catch (e) { setSendError(String(e)) }
    finally { setSending(false) }
  }

  const generateScript = async () => {
    const copy = unit4Data?.results ? Object.values(unit4Data.results)[0]?.slice(0, 300) : ''
    setGeneratingScript(true)
    try {
      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: ['line_message'],
          userInstructions: `請改寫為電話行銷腳本，語言：${scriptLang}。
格式：問候→自我介紹→痛點→解決方案→行動呼籲，共約 30-60 秒口語化內容（約 100-150 字）。
純口語，不含任何格式符號或 Markdown。`,
          companyData: unit2Data ?? {},
          collectedSummary: copy,
        }),
      })
      const data = await res.json()
      const raw: string = data?.results?.line_message ?? ''
      setScript(raw.slice(0, 800))
    } catch { /* silent */ }
    finally { setGeneratingScript(false) }
  }

  const preview = async () => {
    if (!script.trim()) { setPreviewError(t('u10.errNeedScript2')); return }
    setPreviewLoading(true); setPreviewError(''); setPreviewUrl('')
    try {
      const res = await fetch('/api/marketing/phone-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tts', script: script.trim(), voiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreviewUrl(data.audioUrl)
    } catch (e) { setPreviewError(String(e)) }
    finally { setPreviewLoading(false) }
  }

  const startCalling = async () => {
    if (!script.trim()) { setCallError(t('u10.errNeedScript')); return }
    if (phones.length === 0) { setCallError(t('u10.errNeedPhone')); return }
    setCalling(true); setCallError(''); setResults([])
    try {
      const res = await fetch('/api/marketing/phone-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', script: script.trim(), phones, voiceId, birdCallerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
      onDone({ lastBatch: { total: data.total, success: data.success, results: data.results, audioUrl: data.audioUrl, calledAt: new Date().toISOString() } })
    } catch (e) { setCallError(String(e)) }
    finally { setCalling(false) }
  }

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([['phone', `📞 ${t('u10.tabPhone')}`], ['email', `📧 ${t('u10.tabEmail')}`]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Email tab ── */}
      {activeTab === 'email' && (
        <div className="space-y-5">

          {/* Provider bar */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700 w-fit">
            ✉️ {t('u10.sendService')}
          </div>

          {/* 寄件人統一由系統設定，客戶無需填寫 */}
          <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 leading-relaxed">
            {t('u10.systemManaged')}
          </div>

          {/* ── Step 1: Email 模板 ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t('u10.step1Title')}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{t('u10.step1Hint')}</div>
              </div>
              {(unit4Data?.results?.email_subject || unit4Data?.results?.email_body) && (
                <button
                  onClick={() => setEmailTemplates(prev => prev.map(tpl => ({
                    ...tpl,
                    subject: unit4Data.results!.email_subject ?? tpl.subject,
                    body: unit4Data.results!.email_body ?? tpl.body,
                  })))}
                  className="text-xs px-3 py-1.5 rounded-lg border text-indigo-600 border-indigo-300 hover:bg-indigo-50 flex-shrink-0"
                >
                  ⚡ {t('u10.applyUnit4All')}
                </button>
              )}
            </div>

            {emailTemplates.map((tpl, idx) => (
              <div key={tpl.id} className="border rounded-xl p-4 space-y-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground/70 w-5">{idx + 1}</span>
                  <input
                    value={tpl.name}
                    onChange={e => updateEmailTemplate(tpl.id, { name: e.target.value })}
                    placeholder={t('u10.templateNamePlaceholder')}
                    className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-semibold"
                  />
                  {(unit4Data?.results?.email_subject || unit4Data?.results?.email_body) && (
                    <button
                      onClick={() => updateEmailTemplate(tpl.id, {
                        subject: unit4Data.results!.email_subject ?? tpl.subject,
                        body: unit4Data.results!.email_body ?? tpl.body,
                      })}
                      className="text-[10px] text-indigo-600 hover:underline flex-shrink-0"
                    >
                      {t('u10.applyUnit4')}
                    </button>
                  )}
                  {emailTemplates.length > 1 && (
                    <button onClick={() => removeEmailTemplate(tpl.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/70 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">{t('u10.emailSubject')}</label>
                  <input
                    value={tpl.subject}
                    onChange={e => updateEmailTemplate(tpl.id, { subject: e.target.value })}
                    placeholder={t('u10.emailSubjectPlaceholder')}
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">{t('u10.emailBody')}</label>
                  <textarea
                    value={tpl.body}
                    onChange={e => updateEmailTemplate(tpl.id, { body: e.target.value })}
                    rows={4}
                    placeholder={t('u10.emailBodyPlaceholder')}
                    className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 resize-none bg-white"
                  />
                </div>
              </div>
            ))}
            <button onClick={addEmailTemplate}
              className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:bg-muted/50 justify-center">
              <Plus className="h-3.5 w-3.5" />{t('u10.addTemplate')}
            </button>
          </div>

          {/* ── Step 2: 發送規則 ── */}
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">{t('u10.step2Title')}</div>
              <div className="text-[10px] text-muted-foreground/70 mt-0.5">{t('u10.step2Hint')}</div>
            </div>

            {emailRules.map((rule, idx) => (
              <div key={rule.id} className="border rounded-xl p-4 space-y-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground/70 w-5">{idx + 1}</span>
                  <input
                    value={rule.name}
                    onChange={e => updateEmailRule(rule.id, { name: e.target.value })}
                    placeholder={t('u10.categoryNamePlaceholder')}
                    className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-semibold"
                  />
                  {emailRules.length > 1 && (
                    <button onClick={() => removeEmailRule(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/70 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">{t('u10.aiBasis')}</label>
                  <input
                    value={rule.desc}
                    onChange={e => updateEmailRule(rule.id, { desc: e.target.value })}
                    placeholder={t('u10.aiBasisPlaceholder')}
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">{t('u10.applyTemplate')}</label>
                  <select
                    value={rule.templateId}
                    onChange={e => updateEmailRule(rule.id, { templateId: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  >
                    {emailTemplates.map((tpl, ti) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name || t('u10.scriptN', { n: ti + 1 })}</option>
                    ))}
                  </select>
                </div>
                {emailRecipients.length > 0 && (
                  <div className="text-[10px] text-muted-foreground/70">
                    {t('u10.classifiedHere', { n: emailRecipients.filter(r => r.group === rule.name).length })}
                  </div>
                )}
              </div>
            ))}
            <button onClick={addEmailRule}
              className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:bg-muted/50 justify-center">
              <Plus className="h-3.5 w-3.5" />{t('u10.addRule')}
            </button>
          </div>

          {/* ── Step 3: 收件人清單 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t('u10.step3Title')}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{t('u10.step3Hint')}</div>
              </div>
              <button onClick={classifyEmails} disabled={classifying || emailRecipients.length === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-muted/50 disabled:opacity-50"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {classifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {classifying ? t('u10.classifying') : t('u10.autoClassify')}
              </button>
            </div>
            <textarea value={emailInput} onChange={e => handleEmailInput(e.target.value)} rows={5}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none font-mono"
              placeholder={'user@example.com\nvip@company.com\nlead@factory.com'} />
            <p className="text-[10px] text-muted-foreground/70">{t('u10.recognizedEmails', { n: emailRecipients.length })}</p>
          </div>

          {/* Parsed preview */}
          {emailRecipients.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-xl p-2">
              {emailRecipients.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs">
                  <span className="font-mono flex-1 text-foreground">{r.email}</span>
                  <select
                    value={r.group}
                    onChange={e => setEmailRecipients(prev => prev.map((x, j) => j === i ? { ...x, group: e.target.value } : x))}
                    className="h-6 px-1.5 rounded border text-[10px] outline-none focus:ring-1 bg-indigo-50 text-indigo-700"
                  >
                    {emailRules.map(rule => <option key={rule.id} value={rule.name}>{rule.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {sendError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{sendError}
            </div>
          )}

          <button onClick={sendEmails} disabled={sending || emailRecipients.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'var(--primary)' }}>
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u10.sendingN', { n: emailRecipients.length })}</>
              : <>✉️ {t('u10.startSendN', { n: emailRecipients.length })}</>}
          </button>

          {/* Email results */}
          {emailResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{t('u10.sendResult')}</span>
                <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  {t('u10.successN', { ok: emailResults.filter(r => r.ok).length, total: emailResults.length })}
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {emailResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${r.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    {r.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="font-mono flex-1">{r.email}</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{r.group}</span>
                    {r.ok
                      ? <span className="text-green-700">{t('u10.sent')}</span>
                      : <span className="text-red-600 truncate max-w-[180px]">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Env notice */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <div className="font-semibold mb-1">{t('u10.envNotice')}</div>
            <div className="flex gap-2 flex-wrap">
              <code className="bg-blue-100 px-1.5 py-0.5 rounded">RESEND_API_KEY</code>
              <code className="bg-blue-100 px-1.5 py-0.5 rounded">RESEND_FROM_EMAIL</code>
            </div>
          </div>
        </div>
      )}

      {/* ── Phone tab ── */}
      {activeTab === 'phone' && <div className="space-y-6">

      {/* Provider info bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-xs font-medium text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5" /> {t('u10.ttsProvider')}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-xs font-medium text-muted-foreground">
          <PhoneCall className="h-3.5 w-3.5" /> {t('u10.callProvider')}
        </div>
        {/* VBEE locked */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-xs text-muted-foreground/70 line-through cursor-not-allowed select-none">
          🇻🇳 {t('u10.vbeeLocked')}
        </div>
      </div>

      {/* ElevenLabs + Bird settings */}
      <div className="p-4 rounded-xl bg-muted/50 border space-y-4">
        <div className="text-xs font-semibold text-muted-foreground">{t('u10.voiceDialSettings')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('u10.elevenVoice')}</label>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              {ELEVEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} — {t(`u10.voice.${v.descKey}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('u10.birdCallerId')}</label>
            <input value={birdCallerId} onChange={e => setBirdCallerId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
              placeholder="+886xxxxxxxxx / +84xxxxxxxxx" />
          </div>
        </div>
      </div>

      {/* Script */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <label className="text-sm font-semibold">{t('u10.phoneScript')}</label>
          <select value={scriptLang} onChange={e => setScriptLang(e.target.value)}
            className="h-7 px-2 rounded-lg border text-xs outline-none focus:ring-1 bg-white">
            {['繁體中文', '越南語', 'English', '簡體中文', '日本語'].map(l =>
              <option key={l}>{l}</option>)}
          </select>
          <button onClick={generateScript} disabled={generatingScript}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-muted/50 disabled:opacity-50 ml-auto"
            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
            {generatingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generatingScript ? t('u10.aiGenerating') : t('u10.aiGenerate')}
          </button>
        </div>
        <textarea value={script} onChange={e => setScript(e.target.value)} rows={8}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder={t('u10.scriptPlaceholder')} />
        <div className="text-[10px] text-muted-foreground/70 mt-1">{t('u10.scriptCount', { n: script.length })}</div>
      </div>

      {/* TTS Preview */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={preview} disabled={previewLoading || !script.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 hover:bg-muted/50 transition-colors">
          {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {previewLoading ? t('u10.genVoice') : t('u10.previewVoice')}
        </button>
        {previewUrl && <audio controls src={previewUrl} className="h-8 flex-1 min-w-0" />}
        {previewError && <span className="text-xs text-red-600">{previewError}</span>}
      </div>

      {/* Phone list */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          {t('u10.phoneList')}
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">{t('u10.recognizedPhones', { n: phones.length })}</span>
        </label>
        <textarea value={phoneInput} onChange={e => handlePhoneInput(e.target.value)} rows={5}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none font-mono"
          placeholder={'+886912345678\n+84901234567\n+1234567890'} />
        <p className="text-[10px] text-muted-foreground/70 mt-1">{t('u10.phoneHint')}</p>
      </div>

      {callError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{callError}
        </div>
      )}

      <button onClick={startCalling} disabled={calling || phones.length === 0 || !script.trim()}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {calling
          ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u10.callingN', { n: phones.length })}</>
          : <><PhoneCall className="h-4 w-4" />{t('u10.startCallN', { n: phones.length })}</>}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{t('u10.callResult')}</span>
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              {t('u10.successN', { ok: results.filter(r => r.ok).length, total: results.length })}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${r.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {r.ok ? <PhoneCall className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <PhoneOff className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                <span className="font-mono font-medium">{r.phone}</span>
                {r.ok
                  ? <span className="text-green-700 ml-auto">{t('u10.callOk')}{r.id ? ` · ${r.id}` : ''}</span>
                  : <span className="text-red-600 ml-auto truncate max-w-[200px]">{r.error}</span>}
              </div>
            ))}
          </div>
          {savedData?.lastBatch && (
            <div className="text-[10px] text-muted-foreground/70">
              {new Date(savedData.lastBatch.calledAt).toLocaleString(locale)} · ElevenLabs + Bird
            </div>
          )}
        </div>
      )}

      {/* Env notice */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
        <div className="font-semibold mb-1">{t('u10.envNotice')}</div>
        <div className="flex gap-2 flex-wrap">
          <code className="bg-blue-100 px-1.5 py-0.5 rounded">ELEVENLABS_API_KEY</code>
          <code className="bg-blue-100 px-1.5 py-0.5 rounded">BIRD_API_KEY</code>
          <code className="bg-blue-100 px-1.5 py-0.5 rounded">BIRD_WORKSPACE_ID</code>
        </div>
      </div>
      </div>}

    </div>
  )
}

// ─── Unit 11: 主播行銷 ────────────────────────────────────────────────────────

interface HeyGenAvatar {
  id: string
  name: string
  preview: string
  gender: string
}

interface HeyGenVoice {
  id: string
  name: string
  language: string
  gender: string
  preview: string
}

interface AvatarVideo {
  videoId: string
  script: string
  avatarName: string
  voiceName: string
  ratio: string
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  createdAt: string
}

interface Unit11Data {
  videos: AvatarVideo[]
  avatarId?: string
  avatarName?: string
  voiceId?: string
  voiceName?: string
  ratio?: string
  background?: string
}

const AVATAR_RATIOS = [
  { value: '16:9', descKey: 'youtube' },
  { value: '9:16', descKey: 'reels' },
  { value: '1:1',  descKey: 'ig' },
]

const BG_PRESETS = [
  { value: '#FFFFFF', key: 'white' },
  { value: '#000000', key: 'black' },
  { value: '#F0F4FF', key: 'lightBlue' },
  { value: '#FFF8F0', key: 'lightOrange' },
  { value: '#F0FFF4', key: 'lightGreen' },
]

function Unit11AvatarMarketing({
  campaignId,
  savedData,
  unit2Data,
  unit4Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit11Data
  unit2Data?: Unit2Data
  unit4Data?: Unit4Data
  onDone: (data: Unit11Data) => void
}) {
  const t = useTranslations('MA')
  const locale = useLocale()
  // Avatars / voices
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([])
  const [voices, setVoices] = useState<HeyGenVoice[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assetsLoaded, setAssetsLoaded] = useState(false)

  // Form
  const [selectedAvatar, setSelectedAvatar] = useState<HeyGenAvatar | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<HeyGenVoice | null>(null)
  const [ratio, setRatio] = useState(savedData?.ratio ?? '16:9')
  const [background, setBackground] = useState(savedData?.background ?? '#FFFFFF')
  const [customBg, setCustomBg] = useState('')

  // Script comes from Unit 4 anchor_script — no local state needed

  // Video submission / polling
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [videos, setVideos] = useState<AvatarVideo[]>(savedData?.videos ?? [])
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // ── Persist settings via effect (avoids stale closure) ───────────────────
  const settingsInitRef = useRef(false)
  useEffect(() => {
    if (!settingsInitRef.current) { settingsInitRef.current = true; return }
    onDone({
      videos,
      avatarId:   selectedAvatar?.id,
      avatarName: selectedAvatar?.name,
      voiceId:    selectedVoice?.id,
      voiceName:  selectedVoice?.name,
      ratio,
      background: customBg || background,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAvatar, selectedVoice, ratio, background, customBg, videos])

  // ── Load avatars & voices ──────────────────────────────────────────────────
  async function loadAssets() {
    setLoadingAssets(true)
    try {
      const [avatarRes, voiceRes] = await Promise.all([
        fetch('/api/marketing/heygen-avatar?type=avatars'),
        fetch('/api/marketing/heygen-avatar?type=voices'),
      ])
      const [avatarJson, voiceJson] = await Promise.all([avatarRes.json(), voiceRes.json()])
      const loadedAvatars: HeyGenAvatar[] = avatarJson.avatars ?? []
      const loadedVoices: HeyGenVoice[]   = voiceJson.voices   ?? []
      setAvatars(loadedAvatars)
      setVoices(loadedVoices)
      setAssetsLoaded(true)
      // Restore saved selection
      if (savedData?.avatarId) {
        const found = loadedAvatars.find(a => a.id === savedData.avatarId)
        if (found) setSelectedAvatar(found)
      }
      if (savedData?.voiceId) {
        const found = loadedVoices.find(v => v.id === savedData.voiceId)
        if (found) setSelectedVoice(found)
      }
    } catch (e) {
      console.error(e)
    }
    setLoadingAssets(false)
  }

  // Auto-load on mount
  useEffect(() => {
    loadAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Poll video status ──────────────────────────────────────────────────────
  function startPolling(videoId: string) {
    if (pollingRef.current[videoId]) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/marketing/heygen-avatar?videoId=${videoId}`)
        const data = await res.json()
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollingRef.current[videoId])
          delete pollingRef.current[videoId]
          setVideos(prev => prev.map(v =>
            v.videoId === videoId
              ? { ...v, status: data.status, videoUrl: data.videoUrl ?? v.videoUrl }
              : v
          ))
        }
      } catch (_) {}
    }, 8000)
    pollingRef.current[videoId] = interval
  }

  // Resume polling for processing videos on mount
  useEffect(() => {
    videos.filter(v => v.status === 'processing').forEach(v => startPolling(v.videoId))
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Submit video generation ───────────────────────────────────────────────
  async function submitVideo() {
    const anchorScript = unit4Data?.results?.anchor_script ?? ''
    if (!selectedAvatar) { setSubmitError(t('u11.errAvatar')); return }
    if (!selectedVoice)  { setSubmitError(t('u11.errVoice')); return }
    if (!anchorScript)   { setSubmitError(t('u11.errScript')); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/marketing/heygen-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: selectedAvatar.id,
          voiceId: selectedVoice.id,
          script: anchorScript,
          ratio,
          background: customBg || background,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? t('u11.submitFailed')); return }

      const newVideo: AvatarVideo = {
        videoId: data.videoId,
        script: anchorScript.slice(0, 80) + (anchorScript.length > 80 ? '…' : ''),
        avatarName: selectedAvatar.name,
        voiceName: selectedVoice.name,
        ratio,
        status: 'processing',
        createdAt: new Date().toISOString(),
      }
      setVideos(prev => [newVideo, ...prev])
      startPolling(data.videoId)
    } catch (e) {
      setSubmitError(String(e))
    }
    setSubmitting(false)
  }

  const bgFinal = customBg || background

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Mic className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            {t('u11.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('u11.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border rounded-lg px-3 py-2">
          <span className="font-medium text-indigo-600">HeyGen</span>
          <span>{t('u11.aiAvatarVideo')}</span>
          <span className="text-muted-foreground/70">·</span>
          <span>{t('u11.autoSave')}</span>
        </div>
      </div>

      {/* Step 1: Loading state */}
      {!assetsLoaded ? (
        <div className="border rounded-xl p-5 space-y-3 bg-indigo-50 border-indigo-200">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-indigo-600" />
            <span className="font-medium text-indigo-800 text-sm">{t('u11.loadAssets')}</span>
          </div>
          {loadingAssets
            ? <div className="flex items-center gap-2 text-sm text-indigo-600"><Loader2 className="h-4 w-4 animate-spin" />{t('u11.loading')}</div>
            : <button onClick={loadAssets}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--primary)' }}>
                {t('u11.reloadAssets')}
              </button>
          }
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left: Config panel */}
          <div className="space-y-4">

            {/* Avatar selector */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{t('u11.selectAvatar')}</span>
                <span className="text-xs text-muted-foreground/70">{t('u11.nAvailable', { n: avatars.length })}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {avatars.map(av => (
                  <button key={av.id} onClick={() => setSelectedAvatar(av)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      selectedAvatar?.id === av.id ? 'border-indigo-400 bg-indigo-50' : 'border-border hover:border-border'
                    }`}>
                    {av.preview
                      ? <img src={av.preview} alt={av.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
                          <Mic className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                    }
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{av.name}</div>
                      <div className="text-[10px] text-muted-foreground/70 capitalize">{av.gender}</div>
                    </div>
                    {selectedAvatar?.id === av.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice selector */}
            <div className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{t('u11.selectVoice')}</span>
                <span className="text-xs text-muted-foreground/70">{t('u11.nAvailable', { n: voices.length })}</span>
              </div>
              <select value={selectedVoice?.id ?? ''}
                onChange={e => setSelectedVoice(voices.find(v => v.id === e.target.value) ?? null)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">{t('u11.chooseVoice')}</option>
                {voices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.language} · {v.gender})
                  </option>
                ))}
              </select>
              {selectedVoice?.preview && (
                <audio controls src={selectedVoice.preview} className="w-full h-8 mt-1" />
              )}
            </div>

            {/* Ratio & Background */}
            <div className="border rounded-xl p-4 space-y-3">
              <span className="font-medium text-sm text-foreground">{t('u11.formatBg')}</span>
              <div className="flex gap-2">
                {AVATAR_RATIOS.map(r => (
                  <button key={r.value} onClick={() => setRatio(r.value)}
                    className={`flex-1 text-center py-2 px-2 rounded-lg border text-xs transition-all ${
                      ratio === r.value ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700' : 'border-border text-muted-foreground hover:border-border'
                    }`}>
                    <div className="font-medium">{t(`u11.ratio.${r.value}`)}</div>
                    <div className="text-[10px] text-muted-foreground/70">{t(`u11.ratioDesc.${r.descKey}`)}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{t('u11.bgColor')}</span>
                {BG_PRESETS.map(b => (
                  <button key={b.value} onClick={() => { setBackground(b.value); setCustomBg('') }}
                    title={t(`u11.bg.${b.key}`)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${background === b.value && !customBg ? 'border-indigo-400 scale-110' : 'border-border'}`}
                    style={{ background: b.value }} />
                ))}
                <input type="color" value={customBg || background}
                  onChange={e => setCustomBg(e.target.value)}
                  className="w-6 h-6 rounded-full border border-border cursor-pointer"
                  title={t('u11.customColor')} />
                <div className="w-5 h-5 rounded border" style={{ background: bgFinal }} />
                <span className="text-[10px] text-muted-foreground/70">{bgFinal}</span>
              </div>
            </div>
          </div>

          {/* Right: Script preview from Unit 4 */}
          <div className="space-y-4">
            <div className="border-2 rounded-xl p-4 space-y-3 border-indigo-200 bg-indigo-50">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-indigo-600" />
                <span className="font-semibold text-sm text-indigo-800">{t('u11.anchorScript')}</span>
                {unit4Data?.anchorDuration && (
                  <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                    {t('u11.durStyle', { dur: unit4Data.anchorDuration, style: unit4Data.anchorStyle ?? '' })}
                  </span>
                )}
              </div>
              {unit4Data?.results?.anchor_script ? (
                <>
                  <div className="text-[10px] text-indigo-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('u11.fromUnit4', { n: unit4Data.results.anchor_script.length })}
                  </div>
                  <div className="bg-white border border-indigo-100 rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {unit4Data.results.anchor_script}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className="text-sm text-indigo-700 font-medium">{t('u11.noScript')}</div>
                  <div className="text-xs text-indigo-500">
                    {t('u11.noScriptHint')}
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}
            <button onClick={submitVideo} disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              style={{ background: 'var(--primary)' }}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u11.submitting')}</> : <><Film className="h-4 w-4" />{t('u11.genVideo')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Video list */}
      {videos.length > 0 && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-foreground">{t('u11.videoLog')}</span>
            <span className="text-xs text-muted-foreground/70">{t('u11.nVideos', { n: videos.length })}</span>
          </div>
          <div className="space-y-3">
            {videos.map(v => (
              <div key={v.videoId} className="border rounded-lg p-3 space-y-2 bg-muted/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        v.status === 'completed' ? 'bg-green-100 text-green-700' :
                        v.status === 'failed'    ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {v.status === 'completed' ? t('u11.stDone') : v.status === 'failed' ? t('u11.stFailed') : t('u11.stProcessing')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{v.avatarName}</span>
                      <span className="text-[10px] text-muted-foreground/70">·</span>
                      <span className="text-[10px] text-muted-foreground">{v.voiceName}</span>
                      <span className="text-[10px] text-muted-foreground/70">·</span>
                      <span className="text-[10px] text-muted-foreground">{v.ratio}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.script}</p>
                    <p className="text-[10px] text-muted-foreground/70">{new Date(v.createdAt).toLocaleString(locale)}</p>
                  </div>
                  {v.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0 mt-0.5" />}
                </div>
                {v.status === 'completed' && v.videoUrl && (
                  <div className="space-y-1.5">
                    <video src={v.videoUrl} controls className="w-full max-h-48 rounded-lg bg-black" />
                    <a href={v.videoUrl} download target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                      <Download className="h-3.5 w-3.5" />{t('u11.downloadVideo')}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Env var hint */}
      <div className="bg-muted/50 border rounded-xl p-3 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-muted-foreground">{t('u11.envHint')}</div>
        <div className="flex gap-2 flex-wrap">
          <code className="bg-indigo-100 px-1.5 py-0.5 rounded">HEYGEN_API_KEY</code>
        </div>
      </div>
    </div>
  )
}

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoon({ unit }: { unit: UnitDef }) {
  const t = useTranslations('MA')
  const Icon = unit.icon
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
        <Icon className="h-8 w-8" style={{ color: 'var(--primary)' }} />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">{t(`unit.${unit.id}.name`)}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t(`unit.${unit.id}.desc`)}</p>
      <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
        {t('comingSoon')}
      </span>
    </div>
  )
}

// ─── 方案鎖定卡：單元未達方案時取代單元內容 ─────────────────────────────────────
function UnitPlanLock({ requiredPlan, currentPlan }: { requiredPlan: string | null; currentPlan: string }) {
  return (
    <div className="flex items-center justify-center min-h-[280px]">
      <div className="max-w-sm w-full rounded-2xl border bg-white p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          此單元需 {requiredPlan} 方案，目前方案：{currentPlan === 'free' ? '免費' : currentPlan.toUpperCase()}
        </p>
        <a href="/marketing/plan"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary">
          查看方案並升級
        </a>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingAutoPage() {
  const t = useTranslations('MA')
  const locale = useLocale()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignTitle, setCampaignTitle] = useState(t('mp.untitled'))
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [creating, setCreating] = useState(false)
  const [campaignMenu, setCampaignMenu] = useState<string | null>(null) // campaign id with open "..." menu
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [activeUnit, setActiveUnit] = useState(1)

  // 行銷方案：單元 6/8/9/10/11 依方案鎖定（權威判斷在 API，這裡是體驗層）
  const planInfo = useMarketingPlan()
  const mf = planInfo?.features
  // 尚未載入（planInfo=null）時不鎖，避免閃爍；載入後依權限判斷
  const unitLockRequires: Record<number, string | null> = {
    6:  mf && !mf.imageGen ? 'PRO 以上' : null,
    8:  mf && !mf.videoGen ? 'TEAM 以上' : null,
    9:  mf && !mf.uploadPlatforms ? 'PRO 以上' : null,
    10: mf && !mf.aiCallEmail && mf.prospectMarketing === 'collectOnly' ? 'PRO 以上' : null,
    11: mf && !mf.avatarMarketing ? '企業' : null,
  }

  const [unitStatuses, setUnitStatuses] = useState<Record<number, UnitStatus>>({})
  const [unitData, setUnitData] = useState<Record<number, unknown>>({})

  // Drive folders — per unit (5, 6, 7), persisted per campaign as drive_folders JSON map
  const [driveFolders, setDriveFolders] = useState<Record<number, { id: string; name: string }>>({})
  const [driveImages, setDriveImages] = useState<Record<number, DrivePickedImage | null>>({})

  // Shared company data (Unit 2) — global, not per campaign
  const [companyData, setCompanyData] = useState<Unit2Data>({})
  const [compiledCompanyMd, setCompiledCompanyMd] = useState<string | null>(null)

  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowCampaigns(false)
        setCampaignMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load shared company data on mount
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => {
        if (d.data) setCompanyData(d.data)
        if (d.compiled_md) setCompiledCompanyMd(d.compiled_md)
      })
      .catch(() => {})
  }, [])

  const loadCampaigns = useCallback(async () => {
    const res = await fetch('/api/marketing/campaign')
    if (!res.ok) return
    const data = await res.json()
    setCampaigns(data.campaigns ?? [])
    return data.campaigns as Array<{ id: string }> ?? []
  }, [])

  // Auto-restore last used campaign on page load
  useEffect(() => {
    const run = async () => {
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('aigate_last_campaign') : null

      if (savedId) {
        try {
          const r = await fetch(`/api/marketing/campaign/${savedId}`)
          if (r.ok) {
            const c = (await r.json()).campaign
            if (c) {
              setCampaignId(c.id)
              setCampaignTitle(c.title ?? t('mp.untitled'))
              setUnitStatuses(c.unit_statuses ?? {})
              setUnitData(c.unit_data ?? {})
              return
            }
          }
        } catch { /* ignore, fall through */ }
      }

      const list = await loadCampaigns()
      if (!list?.length) return

      const lastId = list[0].id
      try {
        const r = await fetch(`/api/marketing/campaign/${lastId}`)
        if (!r.ok) return
        const c = (await r.json()).campaign
        if (!c) return
        setCampaignId(c.id)
        setCampaignTitle(c.title ?? t('mp.untitled'))
        setUnitStatuses(c.unit_statuses ?? {})
        setUnitData(c.unit_data ?? {})
        if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', c.id)
      } catch { /* ignore */ }
    }
    run()
  }, [loadCampaigns])

  const createCampaign = useCallback(async (): Promise<string | null> => {
    setCreating(true)
    const title = campaignTitle
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.id) {
      setCampaignId(data.id)
      loadCampaigns()
      if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', data.id)
      return data.id as string
    }
    return null
  }, [campaignTitle, loadCampaigns])

  const loadCampaign = async (id: string) => {
    const res = await fetch(`/api/marketing/campaign/${id}`)
    if (!res.ok) return
    const c = (await res.json()).campaign
    setCampaignId(c.id)
    setCampaignTitle(c.title ?? t('mp.untitled'))
    setUnitStatuses(c.unit_statuses ?? {})
    setUnitData(c.unit_data ?? {})
    setDriveFolders(c.drive_folders ?? {})
    setDriveImages({})
    setShowCampaigns(false)
    if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', id)
  }

  const ensureCampaign = useCallback(async (): Promise<string | null> => {
    if (campaignId) return campaignId
    return createCampaign()
  }, [campaignId, createCampaign])

  const saveUnitResult = useCallback(async (unitId: number, data: unknown, cid?: string) => {
    const id = cid ?? campaignId
    if (!id) return
    const newStatuses = { ...unitStatuses, [unitId]: 'done' as UnitStatus }
    const newData = { ...unitData, [unitId]: data }
    setUnitStatuses(newStatuses)
    setUnitData(newData)
    await patchCampaign(id, { unit_statuses: newStatuses, unit_data: newData })
  }, [campaignId, unitStatuses, unitData])

  const handleUnit1Done = useCallback(async (data: Unit1Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(1, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit2Save = useCallback(async (data: Unit2Data) => {
    setCompanyData(data)
    await fetch('/api/marketing/company-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }, [])

  const handleUnit3Done = useCallback(async (data: Unit3Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(3, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit4Done = useCallback(async (data: Unit4Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(4, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit5Done = useCallback(async (data: Unit5Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(5, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit6Done = useCallback(async (data: Unit6Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(6, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit7Done = useCallback(async (data: Unit7Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(7, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit8Done = useCallback(async (data: Unit8Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(8, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit9Done = useCallback(async (data: Unit9Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(9, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit10Done = useCallback(async (data: Unit10Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(10, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleUnit11Done = useCallback(async (data: Unit11Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(11, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleDriveFolderChange = useCallback(async (unitId: number, id: string, name: string) => {
    const next = { ...driveFolders, [unitId]: { id, name } }
    setDriveFolders(next)
    const cid = await ensureCampaign()
    if (cid) await patchCampaign(cid, { drive_folders: next })
  }, [ensureCampaign, driveFolders])

  const currentUnit = UNITS.find(u => u.id === activeUnit) ?? SIDE_TOOLS.find(st => st.id === activeUnit) ?? UNITS[0]

  return (
    <div className="flex h-[calc(100vh-53px)] overflow-hidden">

      {/* Left nav */}
      <aside className="w-56 shrink-0 border-r bg-muted/50 flex flex-col select-none">
        {/* Campaign selector */}
        <div className="p-3 border-b space-y-2">
          <div className="relative" ref={dropRef}>
            <button onClick={() => setShowCampaigns(!showCampaigns)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-left hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{campaignTitle}</div>
                <div className="text-[10px] text-muted-foreground/70">{campaignId ? t('mp.saved') : t('mp.notCreated')}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
            </button>

            {showCampaigns && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                <button onClick={() => { setCampaignId(null); setCampaignTitle(t('mp.untitled')); setUnitStatuses({}); setUnitData({}); setShowCampaigns(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 text-left border-b"
                  style={{ color: 'var(--primary)' }}>
                  <Plus className="h-3.5 w-3.5" /> {t('mp.newProject')}
                </button>
                {campaigns.map(c => (
                  <div key={c.id} className={`relative flex items-center group ${c.id === campaignId ? 'bg-muted/50 font-medium' : ''}`}>
                    {/* rename inline */}
                    {renamingId === c.id ? (
                      <div className="flex-1 flex items-center gap-1 px-3 py-1.5">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              await patchCampaign(c.id, { title: renameValue })
                              setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, title: renameValue } : x))
                              if (c.id === campaignId) setCampaignTitle(renameValue)
                              setRenamingId(null)
                            }
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="flex-1 h-6 px-1 text-xs border rounded outline-none focus:ring-1"
                        />
                        <button onClick={async () => {
                          await patchCampaign(c.id, { title: renameValue })
                          setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, title: renameValue } : x))
                          if (c.id === campaignId) setCampaignTitle(renameValue)
                          setRenamingId(null)
                        }} className="p-0.5 text-green-600 hover:text-green-700">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => loadCampaign(c.id)}
                        className="flex-1 flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/50 text-left">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{c.title}</div>
                          <div className="text-muted-foreground/70 text-[10px]">{new Date(c.updated_at).toLocaleDateString(locale)}</div>
                        </div>
                        {c.id === campaignId && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                      </button>
                    )}
                    {/* "..." menu */}
                    {renamingId !== c.id && (
                      <div className="relative flex-shrink-0 pr-1">
                        <button
                          onClick={e => { e.stopPropagation(); setCampaignMenu(campaignMenu === c.id ? null : c.id) }}
                          className="p-1 rounded text-muted-foreground/70 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {campaignMenu === c.id && (
                          <div className="absolute right-0 top-full mt-0.5 w-24 bg-white border rounded-lg shadow-lg z-50 overflow-hidden text-xs">
                            <button onClick={() => { setRenamingId(c.id); setRenameValue(c.title); setCampaignMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left">
                              <Pencil className="h-3 w-3" /> {t('mp.rename')}
                            </button>
                            <button onClick={async () => {
                              if (!confirm(t('mp.confirmDelete', { title: c.title }))) return
                              await fetch(`/api/marketing/campaign/${c.id}`, { method: 'DELETE' })
                              if (c.id === campaignId) { setCampaignId(null); setCampaignTitle(t('mp.untitled')); setUnitStatuses({}); setUnitData({}) }
                              setCampaigns(prev => prev.filter(x => x.id !== c.id))
                              setCampaignMenu(null)
                            }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 text-left">
                              <Trash2 className="h-3 w-3" /> {t('mp.delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {campaigns.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground/70 text-center">{t('mp.noProjects')}</div>}
              </div>
            )}
          </div>

          <input value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)}
            onBlur={() => { if (campaignId) patchCampaign(campaignId, { title: campaignTitle }) }}
            className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-1 bg-white"
            placeholder={t('mp.projectNamePh')} />

          {!campaignId && (
            <button onClick={createCampaign} disabled={creating}
              className="w-full flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {creating ? t('mp.creating') : t('mp.createProject')}
            </button>
          )}
        </div>

        {/* Units */}
        <nav className="flex-1 overflow-y-auto py-2">
          {UNITS.map(unit => {
            const Icon = unit.icon
            const isActive = unit.id === activeUnit
            const status = unitStatuses[unit.id] ?? 'idle'
            return (
              <button key={unit.id} onClick={() => setActiveUnit(unit.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-r-2 ${
                  isActive ? 'bg-white font-semibold' : 'border-transparent hover:bg-white/60'
                }`}
                style={isActive ? { borderRightColor: 'var(--primary)' } : {}}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={isActive
                    ? { background: 'color-mix(in oklch, var(--primary) 12%, transparent)' }
                    : { background: '#e5e7eb' }}>
                  <Icon className="h-3.5 w-3.5"
                    style={isActive ? { color: 'var(--primary)' } : { color: '#9ca3af' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{t(`unit.${unit.id}.name`)}</div>
                  {!unit.implemented && <div className="text-[10px] text-muted-foreground/70">{t('mp.underConstruction')}</div>}
                </div>
                {status === 'done'    && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                {status === 'running' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />}
                {status === 'error'   && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <div className="text-[10px] font-semibold text-muted-foreground/70 px-2 py-1 uppercase tracking-wide">{t('mp.otherTools')}</div>
          <a href={campaignId ? `/marketing-pipeline?campaign=${campaignId}` : '/marketing-pipeline'}
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-amber-600 hover:bg-amber-50">
            <Zap className="h-3.5 w-3.5" /> {t('mp.automation')}
            {campaignId && <span className="ml-auto text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">{t('mp.linked')}</span>}
          </a>
          {SIDE_TOOLS.map(tool => {
            const Icon = tool.icon
            const isActive = activeUnit === tool.id
            return tool.href ? (
              <a key={tool.id} href={tool.href}
                className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-blue-600 hover:bg-blue-50">
                <Icon className="h-3.5 w-3.5" /> {t(`unit.${tool.id}.name`)}
              </a>
            ) : (
              <button key={tool.id} onClick={() => setActiveUnit(tool.id)}
                className={`w-full flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-left ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-blue-600 hover:bg-blue-50'
                }`}>
                <Icon className="h-3.5 w-3.5" /> {t(`unit.${tool.id}.name`)}
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t space-y-1">
          <a href="/settings#company"
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-blue-600 hover:bg-blue-50">
            <Building2 className="h-3.5 w-3.5" /> {t('mp.companySettings')}
          </a>
          <a href="/marketing-auto/platforms"
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-muted-foreground hover:bg-muted/70 hover:text-foreground">
            <Settings className="h-3.5 w-3.5" /> {t('u12.platformSettings')}
          </a>
        </div>
      </aside>

      {/* Right content */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
            <currentUnit.icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h1 className="font-bold text-base text-foreground">{UNITS.find(u => u.id === activeUnit) ? `${currentUnit.id}. ` : ''}{t(`unit.${currentUnit.id}.name`)}</h1>
            <p className="text-xs text-muted-foreground/70">{t(`unit.${currentUnit.id}.desc`)}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={unitStatuses[activeUnit] ?? 'idle'} />
          </div>
        </div>

        <div className="px-6 py-6 max-w-3xl">
          {activeUnit === 1 && (
            <Unit1Collect
              campaignId={campaignId}
              savedData={unitData[1] as Unit1Data | undefined}
              onDone={handleUnit1Done}
            />
          )}
          {activeUnit === 3 && (
            <Unit3Analyze
              campaignId={campaignId}
              savedData={unitData[3] as Unit3Data | undefined}
              unit1Data={unitData[1] as { summary?: string; raw?: string } | undefined}
              unit2Data={companyData}
              onDone={handleUnit3Done}
            />
          )}
          {activeUnit === 4 && (
            <Unit4Copy
              campaignId={campaignId}
              savedData={unitData[4] as Unit4Data | undefined}
              unit1Data={unitData[1] as { summary?: string } | undefined}
              unit2Data={companyData}
              unit3Data={unitData[3] as Unit3Data | undefined}
              onDone={handleUnit4Done}
            />
          )}
          {activeUnit === 5 && (
            <Unit5ImageScript
              campaignId={campaignId}
              savedData={unitData[5] as Unit5Data | undefined}
              unit1Data={unitData[1] as { summary?: string } | undefined}
              unit2Data={companyData}
              unit3Data={unitData[3] as Unit3Data | undefined}
              unit4Data={unitData[4] as Unit4Data | undefined}
              driveFolderId={driveFolders[5]?.id}
              driveFolderName={driveFolders[5]?.name}
              drivePickedImage={driveImages[5] ?? null}
              onDriveFolderChange={(id, name) => handleDriveFolderChange(5, id, name)}
              onDriveImagePicked={img => setDriveImages(prev => ({ ...prev, 5: img }))}
              onDone={handleUnit5Done}
            />
          )}
          {activeUnit === 6 && unitLockRequires[6] && (
            <UnitPlanLock requiredPlan={unitLockRequires[6]} currentPlan={planInfo?.plan ?? 'free'} />
          )}
          {activeUnit === 6 && !unitLockRequires[6] && (
            <Unit6ImageGenerate
              campaignId={campaignId}
              savedData={unitData[6] as Unit6Data | undefined}
              unit5Data={unitData[5] as Unit5Data | undefined}
              driveFolderId={driveFolders[6]?.id}
              driveFolderName={driveFolders[6]?.name}
              drivePickedImage={driveImages[6] ?? null}
              onDriveFolderChange={(id, name) => handleDriveFolderChange(6, id, name)}
              onDriveImagePicked={img => setDriveImages(prev => ({ ...prev, 6: img }))}
              onDone={handleUnit6Done}
            />
          )}
          {activeUnit === 7 && (
            <Unit7VideoScript
              campaignId={campaignId}
              savedData={unitData[7] as Unit7Data | undefined}
              unit1Data={unitData[1] as { summary?: string } | undefined}
              unit2Data={companyData}
              unit3Data={unitData[3] as Unit3Data | undefined}
              unit4Data={unitData[4] as Unit4Data | undefined}
              unit5Data={unitData[5] as Unit5Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              driveFolderId={driveFolders[7]?.id}
              driveFolderName={driveFolders[7]?.name}
              drivePickedImage={driveImages[7] ?? null}
              onDriveFolderChange={(id, name) => handleDriveFolderChange(7, id, name)}
              onDriveImagePicked={img => setDriveImages(prev => ({ ...prev, 7: img }))}
              onDone={handleUnit7Done}
            />
          )}
          {activeUnit === 8 && unitLockRequires[8] && (
            <UnitPlanLock requiredPlan={unitLockRequires[8]} currentPlan={planInfo?.plan ?? 'free'} />
          )}
          {activeUnit === 8 && !unitLockRequires[8] && (
            <Unit8VideoGenerate
              campaignId={campaignId}
              savedData={unitData[8] as Unit8Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              unit7Data={unitData[7] as Unit7Data | undefined}
              drivePickedImage={driveImages[7] ?? driveImages[5] ?? null}
              onDone={handleUnit8Done}
            />
          )}
          {activeUnit === 9 && unitLockRequires[9] && (
            <UnitPlanLock requiredPlan={unitLockRequires[9]} currentPlan={planInfo?.plan ?? 'free'} />
          )}
          {activeUnit === 9 && !unitLockRequires[9] && (
            <Unit9Upload
              campaignId={campaignId}
              savedData={unitData[9] as Unit9Data | undefined}
              unit4Data={unitData[4] as Unit4Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              unit8Data={unitData[8] as Unit8Data | undefined}
              onDone={handleUnit9Done}
            />
          )}
          {activeUnit === 10 && unitLockRequires[10] && (
            <UnitPlanLock requiredPlan={unitLockRequires[10]} currentPlan={planInfo?.plan ?? 'free'} />
          )}
          {activeUnit === 10 && !unitLockRequires[10] && (
            <Unit10ProspectMarketing
              campaignId={campaignId}
              savedData={unitData[10] as Unit10Data | undefined}
              unit2Data={companyData}
              unit4Data={unitData[4] as Unit4Data | undefined}
              onDone={handleUnit10Done}
            />
          )}
          {activeUnit === 11 && unitLockRequires[11] && (
            <UnitPlanLock requiredPlan={unitLockRequires[11]} currentPlan={planInfo?.plan ?? 'free'} />
          )}
          {activeUnit === 11 && !unitLockRequires[11] && (
            <Unit11AvatarMarketing
              campaignId={campaignId}
              savedData={unitData[11] as Unit11Data | undefined}
              unit2Data={companyData}
              unit4Data={unitData[4] as Unit4Data | undefined}
              onDone={handleUnit11Done}
            />
          )}
          {activeUnit !== 1 && activeUnit !== 3 && activeUnit !== 4 && activeUnit !== 5 && activeUnit !== 6 && activeUnit !== 7 && activeUnit !== 8 && activeUnit !== 9 && activeUnit !== 10 && activeUnit !== 11 && <ComingSoon unit={currentUnit} />}
        </div>
      </main>
    </div>

  )
}
