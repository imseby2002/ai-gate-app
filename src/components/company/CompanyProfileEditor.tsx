'use client'

// 公司資料（全公司唯一一份）：基本資料／品牌／產品／門市／素材
// ERP /mkt「公司資料」分頁、行銷中心 /marketing/brand 共用此元件；帳號設定頁只放連結。
//   基本資料、素材 → /api/marketing/company-data（mkt_brand 公司欄位）
//   品牌           → /api/mkt/brand（mkt_brand 品牌欄位）
//   產品           → /api/mkt/products（mkt_product_profiles）
//   門市           → /api/mkt/stores（fin_stores + mkt_store_profiles）
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, AlertCircle, Plus, Trash2, Pencil, X, Save, Sparkles, MapPin, ExternalLink,
  Building2, UtensilsCrossed, Upload, Image as ImageIcon, Camera, Palette, FileText, Landmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ProductLaunchesSection } from '@/components/marketing/ProductLaunchesSection'

const selCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'
const ta = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm'

// 產業別／員工人數：資料庫存中文原值（既有資料相容），畫面依語系顯示 CompanyProfile.industry.* / employees.*
const INDUSTRY_OPTIONS: [string, string][] = [
  ['科技/軟體', 'tech'], ['製造業', 'manufacturing'], ['零售/電商', 'retail'], ['金融服務', 'finance'], ['醫療健康', 'health'], ['餐飲/消費', 'food'],
  ['教育培訓', 'education'], ['房地產', 'realEstate'], ['物流/運輸', 'logistics'], ['廣告/行銷', 'advertising'], ['旅宿/民宿', 'hospitality'], ['其他', 'other'],
]
const EMPLOYEE_OPTIONS: [string, string][] = [['1-10人', 'e1'], ['11-50人', 'e2'], ['51-200人', 'e3'], ['201-500人', 'e4'], ['501-1000人', 'e5'], ['1000人以上', 'e6']]
// 語氣／特色／標籤是寫進資料、給 AI 讀的文字：依目前語系插入對應文字
const TONE_KEYS = ['formal', 'young', 'warm', 'innovative', 'luxury', 'friendly'] as const

export type CompanyProfileTab = 'basic' | 'brand' | 'products' | 'stores' | 'files'
const TABS: [CompanyProfileTab, React.ReactNode][] = [
  ['basic', <Landmark key="b" className="h-4 w-4" />],
  ['brand', <Palette key="br" className="h-4 w-4" />],
  ['products', <UtensilsCrossed key="p" className="h-4 w-4" />],
  ['stores', <Building2 key="s" className="h-4 w-4" />],
  ['files', <FileText key="f" className="h-4 w-4" />],
]

export function CompanyProfileEditor({ initialTab = 'basic' }: { initialTab?: CompanyProfileTab }) {
  const tc = useTranslations('CompanyProfile')
  const [tab, setTab] = useState<CompanyProfileTab>(initialTab)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => { fetch('/api/mkt/brand').then(r => setAllowed(r.status !== 403)).catch(() => setAllowed(false)) }, [])

  if (allowed === null) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!allowed) return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-2">
      <AlertCircle className="h-10 w-10 mx-auto text-amber-400" />
      <p className="font-semibold">{tc('noPermission')}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit flex-wrap">
        {TABS.map(([id, icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{tc(`tab.${id}`)}</button>
        ))}
      </div>
      {tab === 'basic' ? <BasicTab />
        : tab === 'brand' ? <BrandTab />
        : tab === 'products' ? <ProductsTab />
        : tab === 'stores' ? <StoresTab />
        : <FilesTab />}
    </div>
  )
}

// ─────────────────────── 基本資料 ───────────────────────
interface Basic { legalName: string; industry: string; employees: string; capital: string; founded: string; address: string }
const emptyBasic = (): Basic => ({ legalName: '', industry: '', employees: '', capital: '', founded: '', address: '' })

function BasicTab() {
  const tc = useTranslations('CompanyProfile')
  const [f, setF] = useState<Basic | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/marketing/company-data').then(r => r.json()).then(j => {
      const d = j.data ?? {}
      setF({ legalName: d.legalName ?? '', industry: d.industry ?? '', employees: d.employees ?? '', capital: d.capital ?? '', founded: d.founded ?? '', address: d.address ?? '' })
    }).catch(() => setF(emptyBasic()))
  }, [])

  async function save() {
    if (!f) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/marketing/company-data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    setSaving(false)
    setMsg(r.ok ? 'ok' : 'fail')
  }

  if (!f) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const set = (k: keyof Basic, v: string) => setF({ ...f, [k]: v })

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={tc('legalName')} hint={tc('legalNameHint')}><Input value={f.legalName} onChange={e => set('legalName', e.target.value)} placeholder={tc('legalNamePh')} /></Field>
        <Field label={tc('industry.label')}>
          <select className={`${selCls} w-full`} value={f.industry} onChange={e => set('industry', e.target.value)}>
            <option value="">{tc('pleaseSelect')}</option>
            {INDUSTRY_OPTIONS.map(([v, k]) => <option key={v} value={v}>{tc(`industry.${k}`)}</option>)}
            {f.industry && !INDUSTRY_OPTIONS.some(([v]) => v === f.industry) && <option value={f.industry}>{f.industry}</option>}
          </select>
        </Field>
        <Field label={tc('employees.label')}>
          <select className={`${selCls} w-full`} value={f.employees} onChange={e => set('employees', e.target.value)}>
            <option value="">{tc('pleaseSelect')}</option>
            {EMPLOYEE_OPTIONS.map(([v, k]) => <option key={v} value={v}>{tc(`employees.${k}`)}</option>)}
            {f.employees && !EMPLOYEE_OPTIONS.some(([v]) => v === f.employees) && <option value={f.employees}>{f.employees}</option>}
          </select>
        </Field>
        <Field label={tc('capital')}><Input value={f.capital} onChange={e => set('capital', e.target.value)} placeholder={tc('capitalPh')} /></Field>
        <Field label={tc('founded')}><Input value={f.founded} onChange={e => set('founded', e.target.value)} placeholder={tc('foundedPh')} /></Field>
      </div>
      <Field label={tc('address')}><Input value={f.address} onChange={e => set('address', e.target.value)} placeholder={tc('addressPh')} /></Field>
      <p className="text-xs text-muted-foreground">{tc('basicHint')}</p>
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tc('saveBasic')}</Button>
        {msg && <span className={`text-sm ${msg === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{tc(msg === 'ok' ? 'saved' : 'saveFailed')}</span>}
      </div>
    </div>
  )
}

// ─────────────────────── 素材 ───────────────────────
interface CompanyFile { url: string; name: string; category: 'logo' | 'image' | 'document' | 'faq'; mimeType: string; sizeKb: number; textContent?: string }
const FILE_CATEGORIES: [CompanyFile['category'], string][] = [
  ['logo', '.jpg,.jpeg,.png,.svg,.webp'],
  ['image', '.jpg,.jpeg,.png,.webp,.gif'],
  ['document', '.pdf,.docx,.doc,.txt'],
  ['faq', '.xlsx,.xls,.csv,.docx,.doc,.txt'],
]

function FilesTab() {
  const tc = useTranslations('CompanyProfile')
  const [files, setFiles] = useState<CompanyFile[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/marketing/company-data').then(r => r.json()).then(j => setFiles(j.data?.files ?? [])).catch(() => setFiles([]))
  }, [])

  async function persist(next: CompanyFile[]) {
    setFiles(next)
    const r = await fetch('/api/marketing/company-data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: next }) })
    if (!r.ok) setErr(tc('saveFailed'))
  }

  async function upload(file: File, category: CompanyFile['category']) {
    if (!files) return
    setUploading(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await persist([...files, data as CompanyFile])
    } catch (e) {
      setErr(String(e))
    } finally {
      setUploading(false)
    }
  }

  if (!files) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {FILE_CATEGORIES.map(([cat, accept]) => (
          <div key={cat} className="rounded-xl border p-4 space-y-2">
            <div className="text-xs font-semibold">{tc(`fileCat.${cat}`)}</div>
            {files.filter(f => f.category === cat).map(f => (
              <div key={f.url} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                {f.textContent && <span className="text-emerald-600 text-[10px]">{tc('extracted')}</span>}
                <button type="button" onClick={() => persist(files.filter(x => x.url !== f.url))} className="text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-primary transition-colors">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {tc('uploadFile')}
              <input type="file" accept={accept} className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) { upload(f, cat); e.target.value = '' } }} />
            </label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{tc('filesHint')}</p>
      {err && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{err}</div>}
    </div>
  )
}

// ─────────────────────── 品牌中樞 ───────────────────────
interface BrandPlatforms {
  website?: string; facebook?: string; instagram?: string; line?: string;
  tiktok?: string; threads?: string; zalo?: string; youtube?: string; google_business?: string
}
interface Brand {
  name: string; slogan: string; tagline: string
  colors: { primary?: string; secondary?: string; accent?: string }
  platforms: BrandPlatforms
  fonts: string; tone: string; audience: string; selling_points: string
  banned_words: string; brand_story: string; logo_url: string
}
const emptyBrand = (): Brand => ({ name: '', slogan: '', tagline: '', colors: {}, platforms: {}, fonts: '', tone: '', audience: '', selling_points: '', banned_words: '', brand_story: '', logo_url: '' })

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>{hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function BrandTab() {
  const t = useTranslations('MktPage')
  const tc = useTranslations('CompanyProfile')
  const [b, setB] = useState<Brand | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/mkt/brand').then(async r => {
      const j = await r.json().catch(() => ({}))
      const d = j.brand
      setB(d ? { ...emptyBrand(), ...d, colors: d.colors ?? {}, platforms: d.platforms ?? {} } : emptyBrand())
    })
  }, [])

  async function save() {
    if (!b) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/mkt/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    setSaving(false)
    setMsg(r.ok ? t('brandSaveSuccess') : t('saveFailed'))
  }

  if (!b) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const setColor = (k: 'primary' | 'secondary' | 'accent', v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } })
  const setPlat = (k: keyof BrandPlatforms, v: string) => setB(prev => prev ? { ...prev, platforms: { ...prev.platforms, [k]: v } } : null)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('brandNameLabel')}><Input value={b.name} onChange={e => setB({ ...b, name: e.target.value })} /></Field>
          <Field label={t('sloganLabel')}><Input value={b.slogan} onChange={e => setB({ ...b, slogan: e.target.value })} /></Field>
        </div>
        <Field label={t('taglineLabel')} hint={t('taglineHint')}><Input value={b.tagline} onChange={e => setB({ ...b, tagline: e.target.value })} /></Field>

        <Field label={t('standardColorsLabel')} hint={t('standardColorsHint')}>
          <div className="flex flex-wrap gap-4">
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <input type="color" value={b.colors[k] || '#000000'} onChange={e => setColor(k, e.target.value)} className="h-9 w-12 rounded border border-input bg-transparent cursor-pointer" />
                <Input value={b.colors[k] || ''} onChange={e => setColor(k, e.target.value)} placeholder={k} className="w-28" />
              </div>
            ))}
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('fontsLabel')}><Input value={b.fonts} onChange={e => setB({ ...b, fonts: e.target.value })} placeholder={t('fontsPlaceholder')} /></Field>
          <Field label={t('logoUrlLabel')}><Input value={b.logo_url} onChange={e => setB({ ...b, logo_url: e.target.value })} placeholder="https://" /></Field>
        </div>

        {/* 官方社群與數位通路平台 */}
        <div className="pt-2 border-t">
          <div className="mb-3">
            <span className="font-semibold text-sm">{t('platformsTitle')}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t('platformsDesc')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('websiteLabel')} hint={t('websiteHint')}><Input value={b.platforms?.website ?? ''} onChange={e => setPlat('website', e.target.value)} placeholder="https://..." /></Field>
            <Field label={t('facebookLabel')}><Input value={b.platforms?.facebook ?? ''} onChange={e => setPlat('facebook', e.target.value)} placeholder="https://facebook.com/..." /></Field>
            <Field label="Instagram"><Input value={b.platforms?.instagram ?? ''} onChange={e => setPlat('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field>
            <Field label={t('lineLabel')}><Input value={b.platforms?.line ?? ''} onChange={e => setPlat('line', e.target.value)} placeholder="https://line.me/R/ti/p/..." /></Field>
            <Field label="TikTok"><Input value={b.platforms?.tiktok ?? ''} onChange={e => setPlat('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
            <Field label="Threads"><Input value={b.platforms?.threads ?? ''} onChange={e => setPlat('threads', e.target.value)} placeholder="https://threads.net/@..." /></Field>
            <Field label={t('zaloLabel')} hint={t('zaloHint')}><Input value={b.platforms?.zalo ?? ''} onChange={e => setPlat('zalo', e.target.value)} placeholder="https://zalo.me/..." /></Field>
            <Field label={t('googleBusinessLabel')} hint={t('googleBusinessHint')}><Input value={b.platforms?.google_business ?? ''} onChange={e => setPlat('google_business', e.target.value)} placeholder="https://g.page/..." /></Field>
          </div>
        </div>

        <Field label={t('toneLabel')} hint={t('toneHint')}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TONE_KEYS.map(k => tc(`tone.${k}`)).map(o => (
              <button key={o} type="button" onClick={() => setB({ ...b, tone: o })}
                className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${b.tone === o ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}>{o}</button>
            ))}
          </div>
          <textarea rows={2} className={ta} value={b.tone} onChange={e => setB({ ...b, tone: e.target.value })} placeholder={t('tonePlaceholder')} />
        </Field>
        <Field label={t('audienceLabel')}><textarea rows={2} className={ta} value={b.audience} onChange={e => setB({ ...b, audience: e.target.value })} placeholder={t('audiencePlaceholder')} /></Field>
        <Field label={t('sellingPointsLabel')}><textarea rows={3} className={ta} value={b.selling_points} onChange={e => setB({ ...b, selling_points: e.target.value })} placeholder={t('sellingPointsPlaceholder')} /></Field>
        <Field label={t('brandStoryLabel')}><textarea rows={3} className={ta} value={b.brand_story} onChange={e => setB({ ...b, brand_story: e.target.value })} /></Field>
        <Field label={t('bannedWordsLabel')} hint={t('bannedWordsHint')}><Input value={b.banned_words} onChange={e => setB({ ...b, banned_words: e.target.value })} placeholder={t('bannedWordsPlaceholder')} /></Field>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('saveBrandFile')}</Button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────── 門市圖文資產 ───────────────────────
const STORE_FEATURE_KEYS = ['wifi', 'outlets', 'privateRoom', 'photoWall', 'petFriendly', 'nearMrt', 'outdoor', 'accessible'] as const
interface StoreWithMarketing {
  id: string; code: string; name: string; short_name?: string; region?: string; unit_type?: string; address?: string; active?: boolean
  profile_id?: string | null; photos: string[]; story: string; opening_hours: string; google_maps_url: string
  delivery_urls: Record<string, string>; features: string[]; updated_at?: string | null
}

function StoresTab() {
  const t = useTranslations('MktPage')
  const tc = useTranslations('CompanyProfile')
  const [stores, setStores] = useState<StoreWithMarketing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<StoreWithMarketing | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [msg, setMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadStores = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/mkt/stores')
    const j = await r.json().catch(() => ({}))
    setStores(j.stores ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadStores() }, [loadStores])

  async function handleFileUpload(file: File) {
    setUploading(true); setMsg('')
    const form = new FormData()
    form.append('file', file)
    const r = await fetch('/api/mkt/upload', { method: 'POST', body: form })
    const j = await r.json().catch(() => ({}))
    setUploading(false)
    if (r.ok && j.url && editing) {
      setEditing({ ...editing, photos: [...(editing.photos || []), j.url] })
    } else {
      alert(j.error || t('photoUploadFailed'))
    }
  }

  function addPhotoUrl() {
    if (!newPhotoUrl.trim() || !editing) return
    setEditing({ ...editing, photos: [...(editing.photos || []), newPhotoUrl.trim()] })
    setNewPhotoUrl('')
  }

  function removePhoto(idx: number) {
    if (!editing) return
    const updated = [...editing.photos]
    updated.splice(idx, 1)
    setEditing({ ...editing, photos: updated })
  }

  function toggleFeature(feat: string) {
    if (!editing) return
    const cur = editing.features || []
    const updated = cur.includes(feat) ? cur.filter(f => f !== feat) : [...cur, feat]
    setEditing({ ...editing, features: updated })
  }

  async function saveStore() {
    if (!editing) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/mkt/stores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: editing.id,
        photos: editing.photos,
        story: editing.story,
        opening_hours: editing.opening_hours,
        google_maps_url: editing.google_maps_url,
        delivery_urls: editing.delivery_urls,
        features: editing.features,
      })
    })
    setSaving(false)
    if (r.ok) {
      setMsg(t('storeSaveSuccess'))
      await loadStores()
      setTimeout(() => { setEditing(null); setMsg('') }, 600)
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j.error || t('saveFailed'))
    }
  }

  const filtered = stores.filter(s => {
    const q = search.toLowerCase()
    return (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q) || (s.region || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      {/* 頂部資訊與搜尋 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {t('storesHubTitle')}
            <Badge variant="outline" className="text-xs">{t('storeCount', { n: stores.length })}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('storesHubDesc')}
          </p>
        </div>
        <div className="w-64">
          <Input
            placeholder={t('storeSearchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-card text-muted-foreground text-sm">
          {search ? t('noSearchResultsStore') : t('noStoreData')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {filtered.map(store => {
            const hasPhotos = store.photos && store.photos.length > 0
            const primaryPhoto = hasPhotos ? store.photos[0] : null
            return (
              <div key={store.id} className="rounded-xl border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-colors flex flex-col">
                {/* 封面相簿預覽 */}
                <div className="relative h-44 bg-muted flex items-center justify-center overflow-hidden group">
                  {primaryPhoto ? (
                    <img src={primaryPhoto} alt={store.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="text-center text-muted-foreground space-y-1.5 p-4">
                      <Camera className="h-8 w-8 mx-auto opacity-30" />
                      <div className="text-xs">{t('noStoreFrontPhoto')}</div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(store)}>
                        <Upload className="h-3 w-3" />{t('uploadFirstPhoto')}
                      </Button>
                    </div>
                  )}
                  {hasPhotos && (
                    <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <ImageIcon className="h-3 w-3" />
                      {t('photoCount', { n: store.photos.length })}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <Badge variant="secondary" className="bg-white/90 dark:bg-black/80 backdrop-blur-xs text-xs font-bold text-foreground">
                      [{store.code}] {store.name}
                    </Badge>
                    {store.region && (
                      <Badge variant="outline" className="bg-white/80 dark:bg-black/70 backdrop-blur-xs text-[10px]">
                        {store.region}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 內容區塊 */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    {/* 地址與營業時間 */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      {store.address && (
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
                          <span className="line-clamp-1">{store.address}</span>
                        </div>
                      )}
                      {store.opening_hours && (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>🕒 {store.opening_hours}</span>
                        </div>
                      )}
                    </div>

                    {/* 行銷故事／介紹 */}
                    {store.story ? (
                      <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed bg-muted/30 p-2 rounded-lg">
                        {store.story}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">
                        {t('noStoreStory')}
                      </p>
                    )}

                    {/* 特色標籤 */}
                    {store.features && store.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {store.features.map(f => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 底部按鈕 */}
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {store.google_maps_url && (
                        <a
                          href={store.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />{t('mapNavigation')}
                        </a>
                      )}
                    </div>
                    <Button size="sm" variant="default" className="h-8 text-xs gap-1.5" onClick={() => setEditing(store)}>
                      <Pencil className="h-3.5 w-3.5" />{t('editMarketingAssets')}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 門市編輯彈窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t('editStoreModalTitle', { code: editing.code, name: editing.name })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('editStoreModalDesc')}
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* 門市照片庫 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  {t('storePromoPhotosLabel')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                    e.target.value = ''
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {t('uploadLocalPhoto')}
                </Button>
              </div>

              {/* URL 貼上加入 */}
              <div className="flex gap-2">
                <Input
                  placeholder={t('pastePhotoUrlPlaceholder')}
                  value={newPhotoUrl}
                  onChange={e => setNewPhotoUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={addPhotoUrl}>
                  {t('addUrl')}
                </Button>
              </div>

              {/* 照片預覽縮圖清單 */}
              {editing.photos && editing.photos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                  {editing.photos.map((p, idx) => (
                    <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border bg-muted group">
                      <img src={p} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.2 rounded font-bold">
                          {t('coverPhotoLabel')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        title={t('removePhoto')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-xl text-center text-xs text-muted-foreground">
                  {t('noPhotosAddedStore')}
                </div>
              )}
            </div>

            {/* 故事簡介 */}
            <Field label={t('storyLabel')} hint={t('storyHint')}>
              <textarea
                rows={3}
                className={ta}
                value={editing.story}
                onChange={e => setEditing({ ...editing, story: e.target.value })}
                placeholder={t('storyPlaceholder')}
              />
            </Field>

            {/* 營業時間與 Google 地圖 */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('openingHoursLabel')} hint={t('openingHoursHint')}>
                <Input
                  value={editing.opening_hours}
                  onChange={e => setEditing({ ...editing, opening_hours: e.target.value })}
                  placeholder={t('openingHoursHint')}
                />
              </Field>
              <Field label={t('googleMapsLabel')} hint={t('googleMapsHint')}>
                <Input
                  value={editing.google_maps_url}
                  onChange={e => setEditing({ ...editing, google_maps_url: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </Field>
            </div>

            {/* 特色亮點標籤 */}
            <div>
              <div className="text-xs font-semibold mb-1.5">{t('storeFeatureTagsLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {STORE_FEATURE_KEYS.map(k => tc(`storeFeature.${k}`)).map(f => {
                  const on = (editing.features || []).includes(f)
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFeature(f)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        on ? 'bg-primary text-primary-foreground border-primary font-medium' : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {f} {on && '✓'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 外送平台專屬連結 */}
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold mb-2">{t('deliveryUrlsLabel')}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder={t('grabUrlPlaceholder')}
                  value={editing.delivery_urls?.grab || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, grab: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t('shopeeUrlPlaceholder')}
                  value={editing.delivery_urls?.shopee || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, shopee: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t('foodpandaUrlPlaceholder')}
                  value={editing.delivery_urls?.foodpanda || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, foodpanda: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder={t('ubereatsUrlPlaceholder')}
                  value={editing.delivery_urls?.ubereats || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, ubereats: e.target.value } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="pt-3 border-t flex items-center justify-end gap-3">
              {msg && <span className="text-xs text-emerald-600 font-medium">{msg}</span>}
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button size="sm" onClick={saveStore} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('saveStoreAssets')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 產品圖文資產 ───────────────────────
const PRODUCT_TAG_KEYS = ['new', 'bestseller', 'signature', 'seasonal', 'photogenic', 'light', 'chefPick'] as const
interface ProductProfile {
  id: string; product_code: string; name: string; category: string; price: number
  images: string[]; slogan: string; description: string; flavor_notes: string; tags: string[]
  recipe_id?: string | null; pos_item_id?: string | null; created_at?: string; updated_at?: string
}
interface CandidateProduct {
  source: 'pos' | 'recipe'; id: string; name: string; price: number; note: string; image_url?: string
}

function ProductsTab() {
  const t = useTranslations('MktPage')
  const tc = useTranslations('CompanyProfile')
  const [products, setProducts] = useState<ProductProfile[]>([])
  const [candidates, setCandidates] = useState<CandidateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<Partial<ProductProfile> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [msg, setMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/mkt/products')
    const j = await r.json().catch(() => ({}))
    setProducts(j.products ?? [])
    setCandidates(j.candidates ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  async function handleFileUpload(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const r = await fetch('/api/mkt/upload', { method: 'POST', body: form })
    const j = await r.json().catch(() => ({}))
    setUploading(false)
    if (r.ok && j.url && editing) {
      setEditing({ ...editing, images: [...(editing.images || []), j.url] })
    } else {
      alert(j.error || t('photoUploadFailed'))
    }
  }

  function addImageUrl() {
    if (!newImageUrl.trim() || !editing) return
    setEditing({ ...editing, images: [...(editing.images || []), newImageUrl.trim()] })
    setNewImageUrl('')
  }

  function removeImage(idx: number) {
    if (!editing) return
    const updated = [...(editing.images || [])]
    updated.splice(idx, 1)
    setEditing({ ...editing, images: updated })
  }

  function toggleTag(tag: string) {
    if (!editing) return
    const cur = editing.tags || []
    const updated = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]
    setEditing({ ...editing, tags: updated })
  }

  function importCandidate(c: CandidateProduct) {
    setEditing({
      name: c.name,
      price: c.price,
      category: tc('defaultCategory'),
      slogan: '',
      description: c.note || '',
      flavor_notes: '',
      images: c.image_url ? [c.image_url] : [],
      tags: [tc('productTag.new')],
      pos_item_id: c.source === 'pos' ? c.id : null,
      recipe_id: c.source === 'recipe' ? c.id : null,
    })
  }

  async function saveProduct() {
    if (!editing || !String(editing.name ?? '').trim()) {
      alert(t('productNameRequired'))
      return
    }
    setSaving(true); setMsg('')
    const isNew = !editing.id
    const r = await fetch('/api/mkt/products', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing)
    })
    setSaving(false)
    if (r.ok) {
      setMsg(t('productSaveSuccess'))
      await loadProducts()
      setTimeout(() => { setEditing(null); setMsg('') }, 600)
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j.error || t('saveFailed'))
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm(t('confirmDeleteProduct'))) return
    await fetch('/api/mkt/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    loadProducts()
  }

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchQ = (p.name || '').toLowerCase().includes(q) || (p.slogan || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    const matchCat = !categoryFilter || p.category === categoryFilter
    return matchQ && matchCat
  })

  return (
    <div className="space-y-4">
      {/* 待補行銷圖文提示條 (從 POS/研發配方發現) */}
      {candidates.length > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              {t('candidateFoundHint', { n: candidates.length })}
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-300">{t('clickToImport')}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {candidates.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => importCandidate(c)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white/90 dark:bg-black/60 hover:bg-amber-100/60 transition-colors text-xs font-medium text-amber-950 dark:text-amber-100 shadow-2xs"
              >
                <Plus className="h-3 w-3 text-amber-600" />
                <span className="font-semibold">{c.name}</span>
                <span className="text-[10px] text-muted-foreground">({c.source === 'pos' ? 'POS' : t('sourceRd')})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜尋與分類過濾 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t('productAssetLibraryTitle')}</span>
          <Badge variant="outline" className="text-xs">{t('productCount', { n: products.length })}</Badge>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className={selCls}
            >
              <option value="">{t('allCategories')}</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <Input
            placeholder={t('productSearchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-56 text-xs"
          />
          <Button
            size="sm"
            onClick={() => setEditing({
              name: '', category: tc('defaultCategory'), price: 0, images: [], slogan: '', description: '', flavor_notes: '', tags: [tc('productTag.new')]
            })}
            className="h-9 gap-1 text-xs"
          >
            <Plus className="h-4 w-4" />{t('addProductAssets')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-card text-muted-foreground text-sm">
          {search ? t('noMatchingProducts') : t('noProductAssets')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const hasImg = p.images && p.images.length > 0
            const mainImg = hasImg ? p.images[0] : null
            return (
              <div key={p.id} className="rounded-xl border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-colors flex flex-col justify-between">
                <div>
                  {/* 圖片展示 */}
                  <div className="relative h-40 bg-muted/40 flex items-center justify-center overflow-hidden">
                    {mainImg ? (
                      <img src={mainImg} alt={p.name} className="w-full h-full object-contain p-2 hover:scale-105 transition-transform" />
                    ) : (
                      <div className="text-center text-muted-foreground space-y-1">
                        <ImageIcon className="h-8 w-8 mx-auto opacity-30" />
                        <span className="text-[11px]">{t('noProductImage')}</span>
                      </div>
                    )}
                    {p.category && (
                      <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-white/90 dark:bg-black/80 font-medium shadow-2xs">
                        {p.category}
                      </span>
                    )}
                    {hasImg && (
                      <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                        {t('imageCount', { n: p.images.length })}
                      </span>
                    )}
                  </div>

                  {/* 內容 */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base leading-tight">{p.name}</h3>
                      {p.price > 0 && (
                        <span className="text-xs font-semibold text-primary shrink-0">
                          NT$ {p.price}
                        </span>
                      )}
                    </div>

                    {/* Slogan */}
                    {p.slogan && (
                      <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-1 rounded-md">
                        「{p.slogan}」
                      </div>
                    )}

                    {/* 介紹 */}
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    {/* 風味筆記 */}
                    {p.flavor_notes && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 px-2 py-0.5 rounded">
                        💡 {p.flavor_notes}
                      </div>
                    )}

                    {/* 標籤 */}
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-medium text-foreground/80">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 底部按鈕 */}
                <div className="p-3 pt-2 border-t flex items-center justify-end gap-1.5 bg-muted/10">
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5" />{t('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => deleteProduct(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 產品編輯彈窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  {editing.id ? t('editProductModalTitle', { name: editing.name ?? '' }) : t('addProductModalTitle')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('editProductModalDesc')}
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* 品名與基本資料 */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label={t('productNameLabel')}>
                  <Input
                    value={editing.name ?? ''}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder={t('productNamePlaceholder')}
                  />
                </Field>
              </div>
              <Field label={t('categoryLabel')}>
                <Input
                  value={editing.category ?? ''}
                  onChange={e => setEditing({ ...editing, category: e.target.value })}
                  placeholder={t('categoryPlaceholder')}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('suggestedPriceLabel')}>
                <Input
                  type="number"
                  value={String(editing.price ?? 0)}
                  onChange={e => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={t('sloganFeatureLabel')} hint={t('sloganFeatureHint')}>
                <Input
                  value={editing.slogan ?? ''}
                  onChange={e => setEditing({ ...editing, slogan: e.target.value })}
                  placeholder={t('sloganFeaturePlaceholder')}
                />
              </Field>
            </div>

            {/* 商品照片庫 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  {t('productPromoImagesLabel')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                    e.target.value = ''
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {t('uploadLocalImage')}
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder={t('pasteImageUrlPlaceholder')}
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={addImageUrl}>
                  {t('addUrl')}
                </Button>
              </div>

              {editing.images && editing.images.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {editing.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/40 group p-1 flex items-center justify-center">
                      <img src={img} alt="" className="w-full h-full object-contain" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.2 rounded font-bold">
                          {t('mainImageLabel')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        title={t('removeImage')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-xl text-center text-xs text-muted-foreground">
                  {t('noImagesAddedProduct')}
                </div>
              )}
            </div>

            {/* 美味介紹與風味筆記 */}
            <Field label={t('descriptionLabel')} hint={t('descriptionHint')}>
              <textarea
                rows={3}
                className={ta}
                value={editing.description ?? ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </Field>

            <Field label={t('flavorNotesLabel')} hint={t('flavorNotesHint')}>
              <Input
                value={editing.flavor_notes ?? ''}
                onChange={e => setEditing({ ...editing, flavor_notes: e.target.value })}
                placeholder={t('flavorNotesPlaceholder')}
              />
            </Field>

            {/* 行銷標籤 */}
            <div>
              <div className="text-xs font-semibold mb-1.5">{t('marketingTagsLabel')}</div>
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_TAG_KEYS.map(k => tc(`productTag.${k}`)).map(tag => {
                  const on = (editing.tags || []).includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        on ? 'bg-primary text-primary-foreground border-primary font-medium' : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      #{tag} {on && '✓'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="pt-3 border-t flex items-center justify-end gap-3">
              {msg && <span className="text-xs text-emerald-600 font-medium">{msg}</span>}
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button size="sm" onClick={saveProduct} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('saveProductAssets')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 研發新品上架流水線與 VIP 搶先期排程 */}
      <ProductLaunchesSection />
    </div>
  )
}
