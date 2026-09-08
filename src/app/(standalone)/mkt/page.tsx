'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Loader2, AlertCircle, Megaphone, Palette, CalendarDays, Plus, Trash2, Pencil,
  X, Save, Sparkles, Check, RotateCcw, CalendarPlus, MapPin, Bike, Star, ExternalLink,
  BarChart3, Building2, UtensilsCrossed, Upload, Image as ImageIcon, Camera, Globe,
  CheckCircle2, Search, Tag, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const selCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'
const ta = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm'
type Tab = 'brand' | 'stores' | 'products' | 'generate' | 'offline' | 'delivery' | 'analytics' | 'calendar'

export default function MktPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('brand')

  useEffect(() => { fetch('/api/mkt/brand').then(r => setAllowed(r.status !== 403)) }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅行銷單位可使用</p></div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Megaphone className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">品牌・行銷</h1>
          <p className="text-sm text-muted-foreground">品牌中樞、門市與產品視覺庫、跨平台內容排程</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com' : '/marketing'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            開啟行銷中心 (marketing.im-tourist.com) <ExternalLink className="h-3 w-3" />
          </a>
          <Link href="/office"><Button variant="outline" size="sm">返回公司入口</Button></Link>
        </div>
      </div>

      {/* 提示連結卡片 */}
      <div className="p-3.5 bg-gradient-to-r from-pink-50/80 via-purple-50/60 to-blue-50/60 dark:from-pink-950/30 dark:via-purple-950/20 dark:to-blue-950/20 border border-pink-200/70 dark:border-pink-800/40 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-600 shrink-0" />
          <span className="text-slate-700 dark:text-slate-200">
            行銷部門專用子域名 <code className="font-mono bg-white dark:bg-black/30 px-1.5 py-0.5 rounded text-pink-600 font-bold">marketing.im-tourist.com</code>：包含行銷自動化、AI 視覺工坊、流水線與潛在客戶外呼開發。
          </span>
        </div>
        <a
          href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com' : '/marketing'}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-pink-700 dark:text-pink-300 hover:underline inline-flex items-center gap-1"
        >
          前往行銷中心 ↗
        </a>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit flex-wrap">
        {([
          ['brand', '品牌與官方通路', <Palette key="b" className="h-4 w-4" />],
          ['stores', '門市圖文資產', <Building2 key="s" className="h-4 w-4" />],
          ['products', '產品圖文資產', <UtensilsCrossed key="p" className="h-4 w-4" />],
          ['generate', '一鍵產出', <Sparkles key="g" className="h-4 w-4" />],
          ['offline', '實體行銷', <MapPin key="o" className="h-4 w-4" />],
          ['delivery', '外送平台', <Bike key="d" className="h-4 w-4" />],
          ['analytics', '成效分析', <BarChart3 key="a" className="h-4 w-4" />],
          ['calendar', '內容行事曆', <CalendarDays key="c" className="h-4 w-4" />]
        ] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{label}</button>
        ))}
      </div>

      {tab === 'brand' ? <BrandTab />
        : tab === 'stores' ? <StoresTab />
        : tab === 'products' ? <ProductsTab />
        : tab === 'generate' ? <GenerateTab />
        : tab === 'offline' ? <OfflineTab />
        : tab === 'delivery' ? <DeliveryTab />
        : tab === 'analytics' ? <AnalyticsTab />
        : <CalendarTab />}
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
    setMsg(r.ok ? '✅ 已成功儲存！此處與行銷中心（marketing.im-tourist.com）資料已完全同步。' : '儲存失敗')
  }

  if (!b) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const setColor = (k: 'primary' | 'secondary' | 'accent', v: string) => setB({ ...b, colors: { ...b.colors, [k]: v } })
  const setPlat = (k: keyof BrandPlatforms, v: string) => setB(prev => prev ? { ...prev, platforms: { ...prev.platforms, [k]: v } } : null)

  return (
    <div className="space-y-4">
      {/* 雙向同步提示列 */}
      <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-indigo-950 dark:text-indigo-200">
            品牌資料已與行銷中心（marketing.im-tourist.com/marketing/brand）實時雙向同步。
          </span>
          <span className="text-slate-500">任一邊修改儲存，兩邊皆會即時更新。</span>
        </div>
        <a
          href={typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com') ? 'https://marketing.im-tourist.com/marketing/brand' : '/marketing/brand'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
        >
          在行銷中心開啟此頁 ↗
        </a>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="品牌名稱"><Input value={b.name} onChange={e => setB({ ...b, name: e.target.value })} /></Field>
          <Field label="標語 Slogan"><Input value={b.slogan} onChange={e => setB({ ...b, slogan: e.target.value })} /></Field>
        </div>
        <Field label="一句話定位 Tagline" hint="用一句話說明品牌是什麼"><Input value={b.tagline} onChange={e => setB({ ...b, tagline: e.target.value })} /></Field>

        <Field label="標準色" hint="品牌主色／輔色／點綴色">
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
          <Field label="字型規範"><Input value={b.fonts} onChange={e => setB({ ...b, fonts: e.target.value })} placeholder="標題／內文字型" /></Field>
          <Field label="Logo 連結"><Input value={b.logo_url} onChange={e => setB({ ...b, logo_url: e.target.value })} placeholder="https://" /></Field>
        </div>

        {/* 官方社群與數位通路平台 */}
        <div className="pt-2 border-t">
          <div className="mb-3">
            <span className="font-semibold text-sm">官方社群與數位通路平台</span>
            <p className="text-xs text-muted-foreground mt-0.5">全公司共用統一通路網址（OFFICE 門市後勤、業務手冊與行銷貼文自動引用）</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="官方網站" hint="官網網址"><Input value={b.platforms?.website ?? ''} onChange={e => setPlat('website', e.target.value)} placeholder="https://..." /></Field>
            <Field label="Facebook 粉專"><Input value={b.platforms?.facebook ?? ''} onChange={e => setPlat('facebook', e.target.value)} placeholder="https://facebook.com/..." /></Field>
            <Field label="Instagram"><Input value={b.platforms?.instagram ?? ''} onChange={e => setPlat('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field>
            <Field label="LINE 官方帳號"><Input value={b.platforms?.line ?? ''} onChange={e => setPlat('line', e.target.value)} placeholder="https://line.me/R/ti/p/..." /></Field>
            <Field label="TikTok"><Input value={b.platforms?.tiktok ?? ''} onChange={e => setPlat('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
            <Field label="Threads"><Input value={b.platforms?.threads ?? ''} onChange={e => setPlat('threads', e.target.value)} placeholder="https://threads.net/@..." /></Field>
            <Field label="Zalo 官方帳號" hint="東南亞/越南"><Input value={b.platforms?.zalo ?? ''} onChange={e => setPlat('zalo', e.target.value)} placeholder="https://zalo.me/..." /></Field>
            <Field label="Google 商家主頁" hint="商家檔案"><Input value={b.platforms?.google_business ?? ''} onChange={e => setPlat('google_business', e.target.value)} placeholder="https://g.page/..." /></Field>
          </div>
        </div>

        <Field label="品牌語氣 Tone of Voice" hint="AI 寫文案的口吻"><textarea rows={2} className={ta} value={b.tone} onChange={e => setB({ ...b, tone: e.target.value })} placeholder="例：年輕、活潑、親切，多用口語與 emoji" /></Field>
        <Field label="目標客群"><textarea rows={2} className={ta} value={b.audience} onChange={e => setB({ ...b, audience: e.target.value })} placeholder="例：18–30 歲學生與上班族" /></Field>
        <Field label="產品特色／賣點"><textarea rows={3} className={ta} value={b.selling_points} onChange={e => setB({ ...b, selling_points: e.target.value })} placeholder="每行一個賣點" /></Field>
        <Field label="品牌故事"><textarea rows={3} className={ta} value={b.brand_story} onChange={e => setB({ ...b, brand_story: e.target.value })} /></Field>
        <Field label="禁用詞" hint="AI 產出時避免使用"><Input value={b.banned_words} onChange={e => setB({ ...b, banned_words: e.target.value })} placeholder="以逗號分隔" /></Field>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存品牌檔（雙向同步）</Button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────── 門市圖文資產 ───────────────────────
const STORE_FEATURE_PRESETS = ['免費WiFi', '充電插座', '獨立包廂', '打卡拍照牆', '寵物友善', '近捷運站', '戶外座位', '無障礙空間']
interface StoreWithMarketing {
  id: string; code: string; name: string; short_name?: string; region?: string; unit_type?: string; address?: string; active?: boolean
  profile_id?: string | null; photos: string[]; story: string; opening_hours: string; google_maps_url: string
  delivery_urls: Record<string, string>; features: string[]; updated_at?: string | null
}

function StoresTab() {
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
      alert(j.error || '圖片上傳失敗')
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
      setMsg('已成功儲存門市行銷圖文！')
      await loadStores()
      setTimeout(() => { setEditing(null); setMsg('') }, 600)
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j.error || '儲存失敗')
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
            門市圖文資產中樞
            <Badge variant="outline" className="text-xs">{stores.length} 間營運據點</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            門市基本名稱與代碼由 OFFICE 單位資料統一建立；行銷中心在此補充高畫質門面照、店內氛圍圖、行銷簡介與地圖導航。
          </p>
        </div>
        <div className="w-64">
          <Input
            placeholder="搜尋門市名稱／代碼／地區..."
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
          {search ? '沒有符合搜尋條件的門市' : '目前尚無門市資料，請先至 OFFICE「單位資料」建立門市。'}
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
                      <div className="text-xs">尚無門面照片</div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(store)}>
                        <Upload className="h-3 w-3" />上傳首張照片
                      </Button>
                    </div>
                  )}
                  {hasPhotos && (
                    <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <ImageIcon className="h-3 w-3" />
                      {store.photos.length} 張照片
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
                        尚未填寫行銷故事或門市亮點特色...
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
                          <ExternalLink className="h-3 w-3" />地圖導航
                        </a>
                      )}
                    </div>
                    <Button size="sm" variant="default" className="h-8 text-xs gap-1.5" onClick={() => setEditing(store)}>
                      <Pencil className="h-3.5 w-3.5" />編輯行銷圖文
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
                  編輯門市行銷圖文 — [{editing.code}] {editing.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  基本代碼與地址由 OFFICE 單位資料同步；此處維護對外宣傳照片、故事與導流連結。
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* 門市照片庫 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  門市宣傳照片（門面、內部裝潢、打卡拍照牆）
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
                  本機上傳照片
                </Button>
              </div>

              {/* URL 貼上加入 */}
              <div className="flex gap-2">
                <Input
                  placeholder="或直接貼上照片網址 (https://...)"
                  value={newPhotoUrl}
                  onChange={e => setNewPhotoUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={addPhotoUrl}>
                  加入網址
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
                          封面主圖
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        title="移除照片"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-xl text-center text-xs text-muted-foreground">
                  尚未加入任何門市照片，點擊上方按鈕上傳或貼上網址
                </div>
              )}
            </div>

            {/* 故事簡介 */}
            <Field label="門市特色簡介與故事" hint="顧客介紹／環境氛圍／打卡特色">
              <textarea
                rows={3}
                className={ta}
                value={editing.story}
                onChange={e => setEditing({ ...editing, story: e.target.value })}
                placeholder="例：座落於繁華商圈，擁有挑高自然採光與整面落地植物牆，二樓備有商務會議專用包廂與高速充電座..."
              />
            </Field>

            {/* 營業時間與 Google 地圖 */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="對外營業時間" hint="例：週一至週日 10:00 - 22:00">
                <Input
                  value={editing.opening_hours}
                  onChange={e => setEditing({ ...editing, opening_hours: e.target.value })}
                  placeholder="週一至週日 10:00 - 22:00"
                />
              </Field>
              <Field label="Google 商家／地圖導航連結" hint="顧客一鍵導航">
                <Input
                  value={editing.google_maps_url}
                  onChange={e => setEditing({ ...editing, google_maps_url: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                />
              </Field>
            </div>

            {/* 特色亮點標籤 */}
            <div>
              <div className="text-xs font-semibold mb-1.5">門市特色標籤（點選切換）</div>
              <div className="flex flex-wrap gap-1.5">
                {STORE_FEATURE_PRESETS.map(f => {
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
              <div className="text-xs font-semibold mb-2">外送平台本門市專屬連結（選填）</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder="GrabFood 連結 (https://...)"
                  value={editing.delivery_urls?.grab || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, grab: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="ShopeeFood 連結 (https://...)"
                  value={editing.delivery_urls?.shopee || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, shopee: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Foodpanda 連結 (https://...)"
                  value={editing.delivery_urls?.foodpanda || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, foodpanda: e.target.value } })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="UberEats 連結 (https://...)"
                  value={editing.delivery_urls?.ubereats || ''}
                  onChange={e => setEditing({ ...editing, delivery_urls: { ...editing.delivery_urls, ubereats: e.target.value } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="pt-3 border-t flex items-center justify-end gap-3">
              {msg && <span className="text-xs text-emerald-600 font-medium">{msg}</span>}
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveStore} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                儲存門市圖文
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 產品圖文資產 ───────────────────────
const PRODUCT_TAG_PRESETS = ['新品上市', '人氣熱銷', '招牌必喝', '季節限定', '拍照打卡', '低卡輕盈', '主廚推薦']
interface ProductProfile {
  id: string; product_code: string; name: string; category: string; price: number
  images: string[]; slogan: string; description: string; flavor_notes: string; tags: string[]
  recipe_id?: string | null; pos_item_id?: string | null; created_at?: string; updated_at?: string
}
interface CandidateProduct {
  source: 'pos' | 'recipe'; id: string; name: string; price: number; note: string; image_url?: string
}

function ProductsTab() {
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
      alert(j.error || '圖片上傳失敗')
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
      category: '飲料',
      slogan: '',
      description: c.note || '',
      flavor_notes: '',
      images: c.image_url ? [c.image_url] : [],
      tags: ['新品上市'],
      pos_item_id: c.source === 'pos' ? c.id : null,
      recipe_id: c.source === 'recipe' ? c.id : null,
    })
  }

  async function saveProduct() {
    if (!editing || !String(editing.name ?? '').trim()) {
      alert('請填寫商品名稱')
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
      setMsg('已成功儲存產品行銷圖文！')
      await loadProducts()
      setTimeout(() => { setEditing(null); setMsg('') }, 600)
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j.error || '儲存失敗')
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('確定從行銷視覺庫移除此商品圖文資料？（不會影響研發配方與 POS 品項）')) return
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
              發現 {candidates.length} 個來自研發配方與 POS 點單的商品，尚未建立行銷圖文！
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-300">點選立即帶入</span>
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
                <span className="text-[10px] text-muted-foreground">({c.source === 'pos' ? 'POS' : '研發'})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜尋與分類過濾 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">產品行銷圖文資產庫</span>
          <Badge variant="outline" className="text-xs">{products.length} 項產品</Badge>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className={selCls}
            >
              <option value="">全部分類</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <Input
            placeholder="搜尋品名／Slogan／風味..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-56 text-xs"
          />
          <Button
            size="sm"
            onClick={() => setEditing({
              name: '', category: '飲料', price: 0, images: [], slogan: '', description: '', flavor_notes: '', tags: ['新品上市']
            })}
            className="h-9 gap-1 text-xs"
          >
            <Plus className="h-4 w-4" />新增商品圖文
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-card text-muted-foreground text-sm">
          {search ? '沒有符合條件的商品' : '目前尚無商品行銷檔案，點選上方「新增商品圖文」或從上方候選清單一鍵匯入。'}
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
                        <span className="text-[11px]">尚無去背／情境圖</span>
                      </div>
                    )}
                    {p.category && (
                      <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-white/90 dark:bg-black/80 font-medium shadow-2xs">
                        {p.category}
                      </span>
                    )}
                    {hasImg && (
                      <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                        {p.images.length} 張素材
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
                        {p.tags.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-medium text-foreground/80">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 底部按鈕 */}
                <div className="p-3 pt-2 border-t flex items-center justify-end gap-1.5 bg-muted/10">
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5" />編輯
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
                  {editing.id ? `編輯商品行銷圖文 — ${editing.name}` : '新增商品行銷圖文'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  上傳高解析度商品去背照、撰寫廣告 Slogan 與美味文案，供 AI 生圖與各平台發布引用。
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* 品名與基本資料 */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label="商品名稱 *">
                  <Input
                    value={editing.name ?? ''}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="例：炭焙烏龍鮮奶茶"
                  />
                </Field>
              </div>
              <Field label="分類">
                <Input
                  value={editing.category ?? '一般'}
                  onChange={e => setEditing({ ...editing, category: e.target.value })}
                  placeholder="例：鮮奶茶 / 咖啡 / 甜點"
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="建議售價">
                <Input
                  type="number"
                  value={String(editing.price ?? 0)}
                  onChange={e => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="一句話特色賣點 Slogan" hint="廣告文案標題">
                <Input
                  value={editing.slogan ?? ''}
                  onChange={e => setEditing({ ...editing, slogan: e.target.value })}
                  placeholder="例：濃郁厚焙茶香，交織百分百純鮮奶"
                />
              </Field>
            </div>

            {/* 商品照片庫 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  商品宣傳圖片（高解析度去背 PNG、情境海報）
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
                  本機上傳圖片
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="或直接貼上圖片網址 (https://...)"
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={addImageUrl}>
                  加入網址
                </Button>
              </div>

              {editing.images && editing.images.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {editing.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/40 group p-1 flex items-center justify-center">
                      <img src={img} alt="" className="w-full h-full object-contain" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.2 rounded font-bold">
                          主圖
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        title="移除圖片"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-xl text-center text-xs text-muted-foreground">
                  尚未加入任何商品圖片，上傳白底去背圖有助於後續 AI 自動海報合成
                </div>
              )}
            </div>

            {/* 美味介紹與風味筆記 */}
            <Field label="美味口感描繪與產品故事" hint="AI 生成文案時的重要依據">
              <textarea
                rows={3}
                className={ta}
                value={editing.description ?? ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder="例：精選台灣高山烏龍，經古法低溫慢火細心烘焙，入口甘醇回甘，尾韻帶有濃郁堅果香氣..."
              />
            </Field>

            <Field label="風味筆記與甜度冰塊推薦" hint="例：微糖少冰為最佳黃金比例">
              <Input
                value={editing.flavor_notes ?? ''}
                onChange={e => setEditing({ ...editing, flavor_notes: e.target.value })}
                placeholder="例：推薦微糖少冰，茶香最顯明"
              />
            </Field>

            {/* 行銷標籤 */}
            <div>
              <div className="text-xs font-semibold mb-1.5">行銷標籤（點選切換）</div>
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_TAG_PRESETS.map(t => {
                  const on = (editing.tags || []).includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        on ? 'bg-primary text-primary-foreground border-primary font-medium' : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      #{t} {on && '✓'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 儲存按鈕 */}
            <div className="pt-3 border-t flex items-center justify-end gap-3">
              {msg && <span className="text-xs text-emerald-600 font-medium">{msg}</span>}
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveProduct} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                儲存商品圖文
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 一鍵產出 ───────────────────────
const GEN_CHANNELS: [string, string][] = [['fb', 'Facebook'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['zalo', 'Zalo'], ['line', 'LINE']]
const CONTENT_STATUS_LABEL: Record<string, string> = { review: '待審核', approved: '已核准', scheduled: '已排程', published: '已發布', rejected: '退回' }
const CONTENT_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'default' | 'secondary' | 'destructive'> = { review: 'warning', approved: 'success', scheduled: 'default', published: 'success', rejected: 'destructive' }
interface ContentRow { id: string; topic: string; channels: string[]; status: string; created_at: string }
interface ContentFull { id: string; topic: string; brief: string; channels: string[]; outputs: Record<string, any>; status: string; review_note: string }

function GenerateTab() {
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
    if (!topic.trim()) { setErr('主題必填'); return }
    setGenerating(true); setErr('')
    const r = await fetch('/api/mkt/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, brief, channels }) })
    const j = await r.json().catch(() => ({})); setGenerating(false)
    if (!r.ok) { setErr(j.error || '產出失敗'); return }
    setTopic(''); setBrief('')
    await loadList()
    setDetailId(j.id)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />一鍵產出整套內容</div>
        <p className="text-xs text-muted-foreground">輸入主題／新品，AI 依品牌守則產出各平台文案＋短影片腳本＋圖片提示＋GEO 文章，進入「待審核」，核准後才發布。</p>
        <Field label="主題／新品 *"><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="例：芋頭珍珠鮮奶新品上市" /></Field>
        <Field label="補充說明" hint="賣點、活動、優惠等"><textarea rows={2} className={ta} value={brief} onChange={e => setBrief(e.target.value)} /></Field>
        <div>
          <div className="text-sm font-medium mb-1.5">產出平台</div>
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
          <Button onClick={generate} disabled={generating} className="gap-1.5">{generating ? <><Loader2 className="h-4 w-4 animate-spin" />產出中（約 20–40 秒）</> : <><Sparkles className="h-4 w-4" />AI 產出整套</>}</Button>
          {err && <span className="text-sm text-red-500">{err}</span>}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : list.length === 0 ? <div className="text-center py-10 text-muted-foreground text-sm">尚無產出內容</div>
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
    if (r.ok) { setMsg('已更新'); onChanged() } else setMsg('失敗')
  }
  async function addToCalendar() {
    if (!item) return
    setSaving('cal')
    await fetch('/api/mkt/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.topic, channel: item.channels?.[0] ?? 'other', status: 'scheduled', note: '由一鍵產出核准' }) })
    setSaving(''); setMsg('已加入行事曆')
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
            <span className="text-xs text-muted-foreground">審核後再發布</span>
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
                <div className="space-y-1.5"><div className="text-sm font-semibold">短影片腳本</div>
                  <textarea rows={5} className={ta} value={outputs.video_script ?? ''} onChange={e => setOutputs(o => ({ ...o, video_script: e.target.value }))} /></div>
              )}
              {outputs.image_prompt !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">圖片提示（生圖用）</div>
                  <textarea rows={2} className={ta} value={outputs.image_prompt ?? ''} onChange={e => setOutputs(o => ({ ...o, image_prompt: e.target.value }))} /></div>
              )}
              {outputs.geo_article !== undefined && (
                <div className="space-y-1.5"><div className="text-sm font-semibold">GEO 文章</div>
                  <Input value={outputs.geo_article?.title ?? ''} onChange={e => setGeo('title', e.target.value)} placeholder="標題" />
                  <textarea rows={8} className={ta} value={outputs.geo_article?.body ?? ''} onChange={e => setGeo('body', e.target.value)} /></div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => patch({ outputs }, 'save')} disabled={!!saving} className="gap-1.5">{saving === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存修改</Button>
            <Button size="sm" onClick={() => patch({ status: 'approved' }, 'ap')} disabled={!!saving} className="gap-1.5"><Check className="h-4 w-4" />核准</Button>
            <Button variant="outline" size="sm" onClick={() => patch({ status: 'rejected' }, 'rj')} disabled={!!saving} className="gap-1.5"><RotateCcw className="h-4 w-4" />退回</Button>
            <Button variant="outline" size="sm" onClick={addToCalendar} disabled={!!saving} className="gap-1.5"><CalendarPlus className="h-4 w-4" />加入行事曆</Button>
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
          </div>
        </>}
      </div>
    </div>
  )
}

// ─────────────────────── 實體行銷 ───────────────────────
const OFFLINE_TYPE: [string, string][] = [['material', '門市物料'], ['event', '地推活動'], ['outdoor', '戶外廣告'], ['partner', '異業合作']]
const OFFLINE_TYPE_LABEL: Record<string, string> = Object.fromEntries(OFFLINE_TYPE)
const OFFLINE_STATUS_LABEL: Record<string, string> = { planned: '規劃', active: '進行中', installed: '已上架', done: '完成', cancelled: '取消' }
const OFFLINE_STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'success' | 'warning'> = { planned: 'secondary', active: 'warning', installed: 'default', done: 'success', cancelled: 'secondary' }
interface Offline {
  id: string; type: string; title: string; store: string; status: string
  start_date: string | null; end_date: string | null; budget: number; counterparty: string; photo_url: string; note: string
}
const fmtNum = (n: number) => Math.round(n).toLocaleString('zh-TW')
const blankOffline = (type: string): Partial<Offline> => ({ type, title: '', store: '', status: 'planned', start_date: '', end_date: '', budget: 0, counterparty: '', photo_url: '', note: '' })

function OfflineTab() {
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
    if (!String(editing.title ?? '').trim()) { setErr('標題必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/offline', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/mkt/offline', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">門市物料配發與上架回報、開幕地推、戶外廣告檔期、異業合作，皆可拍照存證。</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className={selCls}>
          <option value="">全部類型</option>
          {OFFLINE_TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">全部狀態</option>
          {Object.entries(OFFLINE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blankOffline(type || 'material')) }}><Plus className="h-4 w-4" />新增</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無實體行銷項目</div>
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
                    {i.store && <span>門市：{i.store}</span>}
                    {i.counterparty && <span>· {i.counterparty}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground space-x-2">
                    {(i.start_date || i.end_date) && <span>{i.start_date ?? ''}{i.end_date ? `～${i.end_date}` : ''}</span>}
                    {i.budget > 0 && <span>· 預算 {fmtNum(i.budget)}</span>}
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
              <h2 className="text-lg font-semibold">{editing.id ? '編輯' : '新增'}實體行銷</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="類型">
                <select value={editing.type ?? 'material'} onChange={e => setEditing({ ...editing, type: e.target.value })} className={`w-full ${selCls}`}>
                  {OFFLINE_TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="狀態">
                <select value={editing.status ?? 'planned'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                  {Object.entries(OFFLINE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <div className="col-span-2"><Field label="標題 *"><Input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="例：新品海報上架 / 河內大學開幕試飲" /></Field></div>
              <Field label="門市"><Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} placeholder="空＝全公司" /></Field>
              <Field label="廠商／合作方"><Input value={editing.counterparty ?? ''} onChange={e => setEditing({ ...editing, counterparty: e.target.value })} /></Field>
              <Field label="開始日"><Input type="date" value={editing.start_date ?? ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} /></Field>
              <Field label="結束日"><Input type="date" value={editing.end_date ?? ''} onChange={e => setEditing({ ...editing, end_date: e.target.value })} /></Field>
              <Field label="預算／費用"><Input type="number" value={String(editing.budget ?? 0)} onChange={e => setEditing({ ...editing, budget: Number(e.target.value) || 0 })} /></Field>
              <Field label="照片連結" hint="上架/存證"><Input value={editing.photo_url ?? ''} onChange={e => setEditing({ ...editing, photo_url: e.target.value })} placeholder="https://" /></Field>
              <div className="col-span-2"><Field label="備註"><textarea rows={2} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field></div>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────── 外送平台 ───────────────────────
const DELIVERY_PLATFORM: [string, string][] = [['grab', 'GrabFood'], ['shopee', 'ShopeeFood'], ['baemin', 'Baemin'], ['other', '其他']]
const DELIVERY_PLATFORM_LABEL: Record<string, string> = Object.fromEntries(DELIVERY_PLATFORM)
const DELIVERY_STATUS_LABEL: Record<string, string> = { online: '上架中', offline: '已下架', pending: '待上架', suspended: '停權' }
const DELIVERY_STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'warning' | 'destructive'> = { online: 'success', offline: 'secondary', pending: 'warning', suspended: 'destructive' }
interface Delivery {
  id: string; platform: string; store: string; status: string; url: string
  commission_rate: number; rating: number; ranking: number | null; period: string
  monthly_orders: number; monthly_revenue: number; promo: string; note: string
}
const blankDelivery = (platform: string): Partial<Delivery> => ({ platform: platform || 'grab', store: '', status: 'online', url: '', commission_rate: 0, rating: 0, ranking: null, period: '', monthly_orders: 0, monthly_revenue: 0, promo: '', note: '' })

function DeliveryTab() {
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
    if (!String(editing.store ?? '').trim()) { setErr('門市必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/delivery', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/mkt/delivery', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const online = items.filter(i => i.status === 'online').length
  const totalOrders = items.reduce((t, i) => t + (i.monthly_orders || 0), 0)
  const totalRevenue = items.reduce((t, i) => t + (i.monthly_revenue || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">上架中</div><div className="mt-1 text-xl font-bold">{online}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">當月訂單</div><div className="mt-1 text-xl font-bold">{fmtNum(totalOrders)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">當月營業額</div><div className="mt-1 text-xl font-bold">{fmtNum(totalRevenue)}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className={selCls}>
          <option value="">全部平台</option>
          {DELIVERY_PLATFORM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blankDelivery(platform || 'grab')) }}><Plus className="h-4 w-4" />新增上架</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無外送平台上架資料</div>
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
                  {i.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{i.rating}{i.ranking ? `　排名 #${i.ranking}` : ''}</span>}
                  {i.commission_rate > 0 && <span className="text-muted-foreground">佣金 {i.commission_rate}%</span>}
                  {i.monthly_orders > 0 && <span className="text-muted-foreground">訂單 {fmtNum(i.monthly_orders)}</span>}
                  {i.monthly_revenue > 0 && <span className="text-muted-foreground">營業額 {fmtNum(i.monthly_revenue)}</span>}
                </div>
                {i.promo && <p className="mt-1 text-sm text-emerald-600">活動：{i.promo}</p>}
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
              <h2 className="text-lg font-semibold">{editing.id ? '編輯' : '新增'}外送上架</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="平台">
                <select value={editing.platform ?? 'grab'} onChange={e => setEditing({ ...editing, platform: e.target.value })} className={`w-full ${selCls}`}>
                  {DELIVERY_PLATFORM.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="狀態">
                <select value={editing.status ?? 'online'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                  {Object.entries(DELIVERY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="門市 *"><Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} /></Field>
              <Field label="店家連結"><Input value={editing.url ?? ''} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://" /></Field>
              <Field label="佣金率 %"><Input type="number" value={String(editing.commission_rate ?? 0)} onChange={e => setEditing({ ...editing, commission_rate: Number(e.target.value) || 0 })} /></Field>
              <Field label="評分"><Input type="number" value={String(editing.rating ?? 0)} onChange={e => setEditing({ ...editing, rating: Number(e.target.value) || 0 })} /></Field>
              <Field label="分類排名"><Input type="number" value={editing.ranking == null ? '' : String(editing.ranking)} onChange={e => setEditing({ ...editing, ranking: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="指標月份"><Input value={editing.period ?? ''} onChange={e => setEditing({ ...editing, period: e.target.value })} placeholder="2026-09" /></Field>
              <Field label="當月訂單數"><Input type="number" value={String(editing.monthly_orders ?? 0)} onChange={e => setEditing({ ...editing, monthly_orders: Number(e.target.value) || 0 })} /></Field>
              <Field label="當月營業額"><Input type="number" value={String(editing.monthly_revenue ?? 0)} onChange={e => setEditing({ ...editing, monthly_revenue: Number(e.target.value) || 0 })} /></Field>
              <div className="col-span-2"><Field label="進行中活動"><Input value={editing.promo ?? ''} onChange={e => setEditing({ ...editing, promo: e.target.value })} placeholder="例：滿 100k 折 20k" /></Field></div>
              <div className="col-span-2"><Field label="備註"><textarea rows={2} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field></div>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
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
  const [snap, setSnap] = useState<MktSnap | null>(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState('')
  const [gen, setGen] = useState('')

  useEffect(() => { fetch('/api/mkt/analytics').then(async r => { if (r.ok) setSnap(await r.json().catch(() => null)); setLoading(false) }) }, [])

  async function genReport(kind: 'weekly' | 'monthly') {
    setGen(kind); setReport('')
    const r = await fetch('/api/mkt/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
    const j = await r.json().catch(() => ({})); setGen('')
    setReport(j.report || j.error || '產生失敗')
  }

  if (loading || !snap) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">外送當月營收</div><div className="mt-1 text-xl font-bold">{fmtNum(snap.delivery.totalRevenue)}</div><div className="text-xs text-muted-foreground">訂單 {fmtNum(snap.delivery.totalOrders)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">行銷總支出</div><div className="mt-1 text-xl font-bold">{fmtNum(snap.spend_total)}</div><div className="text-xs text-muted-foreground">實體 {fmtNum(snap.offline.spend)}＋廣告 {fmtNum(snap.pnl?.advertising ?? 0)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">外送佔營業額</div><div className="mt-1 text-xl font-bold">{snap.delivery_share != null ? (snap.delivery_share * 100).toFixed(1) + '%' : '—'}</div><div className="text-xs text-muted-foreground">{snap.pnl ? `損益 ${snap.pnl.period}` : '無損益資料'}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">內容產出</div><div className="mt-1 text-xl font-bold">{snap.content.total}</div><div className="text-xs text-muted-foreground">待審 {snap.content.review}・已發布 {snap.content.published}</div></div>
      </div>

      {snap.delivery.byPlatform.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">外送平台成效</h2>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50 text-left text-muted-foreground"><th className="px-3 py-2 font-medium">平台</th><th className="px-3 py-2 font-medium text-right">上架</th><th className="px-3 py-2 font-medium text-right">訂單</th><th className="px-3 py-2 font-medium text-right">營收</th></tr></thead>
              <tbody>
                {snap.delivery.byPlatform.map(p => (
                  <tr key={p.platform} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{DELIVERY_PLATFORM_LABEL[p.platform] ?? p.platform}</td>
                    <td className="px-3 py-2 text-right">{p.online}/{p.count}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(p.orders)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snap.offline.byType.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">實體行銷支出</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {snap.offline.byType.map(t => (
              <div key={t.type} className="rounded-lg border bg-card px-3 py-2">
                <div className="text-xs text-muted-foreground">{OFFLINE_TYPE_LABEL[t.type] ?? t.type}</div>
                <div className="mt-0.5 font-semibold">{fmtNum(t.spend)}</div>
                <div className="text-xs text-muted-foreground">{t.count} 項</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">AI 行銷報告</h2>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => genReport('weekly')} disabled={!!gen}>{gen === 'weekly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}週報</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => genReport('monthly')} disabled={!!gen}>{gen === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}月報</Button>
          </div>
        </div>
        {report ? <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{report}</div>
          : <p className="text-sm text-muted-foreground">按「週報／月報」由 AI 依上述資料產出行銷分析與建議行動。</p>}
      </section>
    </div>
  )
}

// ─────────────────────── 內容行事曆 ───────────────────────
interface Item { id: string; title: string; channel: string; scheduled_date: string | null; status: string; note: string }
const CHANNEL_LABEL: Record<string, string> = { fb: 'Facebook', ig: 'Instagram', tiktok: 'TikTok', zalo: 'Zalo', line: 'LINE', store: '門市', other: '其他' }
const STATUS_LABEL: Record<string, string> = { idea: '構想', draft: '草稿', review: '待審核', scheduled: '已排程', published: '已發布' }
const STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'default'> = { idea: 'secondary', draft: 'secondary', review: 'warning', scheduled: 'default', published: 'success' }

const blank = (): Partial<Item> => ({ title: '', channel: 'fb', scheduled_date: '', status: 'idea', note: '' })

function CalendarTab() {
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
    if (!String(editing.title ?? '').trim()) { setErr('標題必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/mkt/calendar', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/mkt/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blank()) }}><Plus className="h-4 w-4" />新增內容</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無排程內容</div>
        : (
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="text-center shrink-0 w-16">
                  <div className="text-xs text-muted-foreground">{i.scheduled_date ? i.scheduled_date.slice(5) : '未排'}</div>
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
              <h2 className="text-lg font-semibold">{editing.id ? '編輯內容' : '新增內容'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <Field label="標題 *"><Input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="平台">
                  <select value={editing.channel ?? 'fb'} onChange={e => setEditing({ ...editing, channel: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="狀態">
                  <select value={editing.status ?? 'idea'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`w-full ${selCls}`}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="排程日"><Input type="date" value={editing.scheduled_date ?? ''} onChange={e => setEditing({ ...editing, scheduled_date: e.target.value })} /></Field>
              </div>
              <Field label="備註"><textarea rows={3} className={ta} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} /></Field>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
