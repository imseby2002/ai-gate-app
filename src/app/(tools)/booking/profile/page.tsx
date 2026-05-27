'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Save, Loader2, ImagePlus, X, Link2, Copy, Check,
  Download, FileText, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, BedDouble, MapPin, Clock, Users, Wifi,
} from 'lucide-react'

const PLATFORMS = [
  { id: 'booking_com', label: 'Booking.com', color: 'bg-blue-600', hint: 'https://www.booking.com/hotel/...' },
  { id: 'agoda',       label: 'Agoda',       color: 'bg-rose-500', hint: 'https://www.agoda.com/...' },
  { id: 'airbnb',      label: 'Airbnb',      color: 'bg-orange-500', hint: 'https://www.airbnb.com/rooms/...' },
  { id: 'other',       label: '其他',        color: 'bg-gray-500', hint: '' },
]

interface ParsedRoom { name: string; description: string | null; max_guests: number; base_price: number | null }
interface ParsedData {
  name: string; description: string | null; address: string | null; city: string | null
  phone: string | null; email: string | null; check_in_time: string | null; check_out_time: string | null
  min_nights: number; house_rules: string | null; amenities: string[]; rooms: ParsedRoom[]
}
interface ImportResult { parsed: ParsedData; images: string[] }

interface BreakfastSettings {
  type: 'none' | 'included' | 'optional'
  price_per_person: number
  start_time: string
  end_time: string
  description: string
}
interface AddonService {
  id: string; name: string; enabled: boolean
  price: number; unit: 'per_trip' | 'per_stay' | 'per_night' | 'per_person'; note: string
}
interface BnbProfile {
  name: string; description: string; address: string; city: string
  phone: string; email: string; website: string; line_id: string
  check_in_time: string; check_out_time: string; min_nights: number
  house_rules: string; images: string[]; slug: string
  breakfast: BreakfastSettings
  addon_services: AddonService[]
}

const DEFAULT_BREAKFAST: BreakfastSettings = {
  type: 'none', price_per_person: 0, start_time: '07:30', end_time: '09:30', description: '',
}
const DEFAULT_ADDONS: AddonService[] = [
  { id: 'shuttle',   name: '接送服務', enabled: false, price: 0, unit: 'per_trip',   note: '' },
  { id: 'baby_crib', name: '嬰兒床',   enabled: false, price: 0, unit: 'per_stay',   note: '' },
  { id: 'extra_bed', name: '加床',     enabled: false, price: 0, unit: 'per_night',  note: '' },
  { id: 'parking',   name: '停車位',   enabled: false, price: 0, unit: 'per_night',  note: '' },
]
const DEFAULT: BnbProfile = {
  name: '', description: '', address: '', city: '',
  phone: '', email: '', website: '', line_id: '',
  check_in_time: '15:00', check_out_time: '11:00', min_nights: 1,
  house_rules: '', images: [], slug: '',
  breakfast: DEFAULT_BREAKFAST,
  addon_services: DEFAULT_ADDONS,
}

const UNIT_LABELS: Record<string, string> = {
  per_trip: '每趟', per_stay: '每次入住', per_night: '每晚', per_person: '每人',
}

type ImportStep = 'input' | 'parsing' | 'preview' | 'done'

export default function BnbProfilePage() {
  const [form, setForm]       = useState<BnbProfile>(DEFAULT)
  const [initialForm, setInitialForm] = useState<BnbProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // OTA import states
  const [importOpen, setImportOpen]       = useState(false)
  const [importStep, setImportStep]       = useState<ImportStep>('input')
  const [importPlatform, setImportPlatform] = useState('booking_com')
  const [importUrl, setImportUrl]         = useState('')
  const [importText, setImportText]       = useState('')
  const [importMode, setImportMode]       = useState<'url' | 'text'>('url')
  const [importError, setImportError]     = useState('')
  const [importFetchFailed, setImportFetchFailed] = useState(false)
  const [parsed, setParsed]               = useState<ParsedData | null>(null)
  const [importImages, setImportImages]   = useState<string[]>([])

  useEffect(() => {
    fetch('/api/booking/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        const p = d.profile
        // Merge saved addon_services with defaults so new defaults always appear
        const savedAddons: AddonService[] = p.addon_services ?? []
        const mergedAddons = DEFAULT_ADDONS.map(def => {
          const saved = savedAddons.find(s => s.id === def.id)
          return saved ?? def
        })
        // Append any custom addons not in defaults
        const extra = savedAddons.filter(s => !DEFAULT_ADDONS.find(d => d.id === s.id))
        const merged = {
          ...DEFAULT, ...p,
          images: p.images ?? [],
          breakfast: p.breakfast ?? DEFAULT_BREAKFAST,
          addon_services: [...mergedAddons, ...extra],
        }
        setForm(merged)
        setInitialForm(merged)
      }
    }).finally(() => setLoading(false))
  }, [])

  function set<K extends keyof BnbProfile>(k: K, v: BnbProfile[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  // 有未儲存變更時，離開/重新整理前提醒
  useEffect(() => {
    const dirtyNow = initialForm ? JSON.stringify(form) !== JSON.stringify(initialForm) : false
    if (!dirtyNow) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form, initialForm])

  function setBreakfast(updates: Partial<BreakfastSettings>) {
    setForm(f => ({ ...f, breakfast: { ...f.breakfast, ...updates } }))
    setSaved(false)
  }

  function updateAddon(id: string, updates: Partial<AddonService>) {
    setForm(f => ({
      ...f,
      addon_services: f.addon_services.map(s => s.id === id ? { ...s, ...updates } : s),
    }))
    setSaved(false)
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/booking/photos', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.url) setForm(f => ({ ...f, images: [...f.images, d.url] }))
    } finally { setUploading(false) }
  }

  async function removePhoto(url: string) {
    setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))
    await fetch('/api/booking/photos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  }

  function setCover(url: string) {
    setForm(f => ({ ...f, images: [url, ...f.images.filter(u => u !== url)] }))
  }

  async function startImportParse() {
    setImportError(''); setImportFetchFailed(false); setImportStep('parsing')
    try {
      const res = await fetch('/api/booking/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importMode === 'url' ? importUrl : '',
          text: importMode === 'text' ? importText : '',
          platform: importPlatform,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setImportFetchFailed(d.fetch_failed ?? false)
        setImportError(d.error ?? '分析失敗')
        setImportStep('input')
        return
      }
      const result = d as ImportResult
      setParsed(result.parsed)
      setImportImages(result.images ?? [])
      setImportStep('preview')
    } catch {
      setImportError('網路錯誤，請重試')
      setImportStep('input')
    }
  }

  async function applyImport() {
    if (!parsed) return
    setForm(f => ({
      ...f,
      name:           parsed.name || f.name,
      description:    parsed.description || f.description,
      address:        parsed.address || f.address,
      city:           parsed.city || f.city,
      phone:          parsed.phone || f.phone,
      email:          parsed.email || f.email,
      check_in_time:  parsed.check_in_time || f.check_in_time,
      check_out_time: parsed.check_out_time || f.check_out_time,
      min_nights:     parsed.min_nights || f.min_nights,
      house_rules:    parsed.house_rules || f.house_rules,
    }))
    setSaved(false)

    // Create room types in background
    const rooms = parsed.rooms?.length ? parsed.rooms : [{ name: parsed.name || '標準房', description: '', max_guests: 2, base_price: null }]
    for (const room of rooms) {
      await fetch('/api/booking/properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: room.name, description: room.description ?? '',
          max_guests: room.max_guests ?? 2, base_price: room.base_price ?? null,
          amenities: parsed.amenities ?? [],
        }),
      })
    }

    setImportStep('done')
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.profile) { setSaved(true); setInitialForm(form) }
      else alert(d.error)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">載入中…</div>

  const { breakfast, addon_services } = form
  const dirty = initialForm ? JSON.stringify(form) !== JSON.stringify(initialForm) : false

  return (
    <div className="p-4 md:p-6 pb-16 max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">民宿基本資料</h1>
          <p className="text-sm text-gray-500 mt-0.5">設定民宿名稱、聯絡方式與入住規則</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? '已儲存 ✓' : '儲存'}
        </button>
      </div>

      {/* OTA 匯入 */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <button type="button" onClick={() => { setImportOpen(o => !o); setImportStep('input'); setImportError('') }}
          className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Download className="h-4 w-4" />
            從 OTA 平台匯入民宿資料
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {!importOpen && <span>Booking.com / Agoda / Airbnb</span>}
            {importOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {importOpen && (
          <div className="border-t px-4 sm:px-5 pb-5 pt-4 space-y-4">
            {importStep === 'done' ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-gray-800">已套用到下方表單</p>
                <p className="text-xs text-gray-500">請確認資料後點「儲存」</p>
                <button onClick={() => { setImportOpen(false); setImportStep('input'); setParsed(null) }}
                  className="text-xs text-indigo-600 underline">關閉</button>
              </div>
            ) : importStep === 'preview' && parsed ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  AI 解析完成，確認後套用至表單
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs text-gray-700">
                  <div className="font-semibold text-sm text-gray-900">{parsed.name || '（未取得名稱）'}</div>
                  {parsed.description && <p className="line-clamp-3 text-gray-600">{parsed.description}</p>}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {parsed.address && <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-400" />{parsed.address}{parsed.city ? ` ${parsed.city}` : ''}</div>}
                    {parsed.phone && <div>📞 {parsed.phone}</div>}
                    {parsed.check_in_time && <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" />入住 {parsed.check_in_time}</div>}
                    {parsed.check_out_time && <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" />退房 {parsed.check_out_time}</div>}
                  </div>
                  {parsed.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {parsed.amenities.slice(0, 12).map(a => (
                        <span key={a} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">{a}</span>
                      ))}
                      {parsed.amenities.length > 12 && <span className="text-[10px] text-gray-400">+{parsed.amenities.length - 12}</span>}
                    </div>
                  )}
                  {parsed.rooms.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mb-1"><BedDouble className="h-3 w-3" />房型 {parsed.rooms.length} 種（將新增至房型管理）</div>
                      {parsed.rooms.slice(0, 3).map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                          <span>{r.name}</span>
                          <span className="text-gray-500 flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{r.max_guests}人{r.base_price ? ` · NT$${r.base_price}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {importImages.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[10px] font-semibold text-gray-500 mb-1.5">找到 {importImages.length} 張圖片（點擊可在新分頁開啟下載）</div>
                      <div className="flex flex-wrap gap-1.5">
                        {importImages.map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                            className="block w-16 h-12 rounded overflow-hidden border border-gray-200 hover:border-indigo-400 transition-colors shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setImportStep('input')}
                    className="flex-1 py-2 rounded-lg border text-xs text-gray-600 hover:bg-gray-50">重新輸入</button>
                  <button onClick={applyImport}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                    套用至表單
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Platform */}
                <div className="grid grid-cols-4 gap-1.5">
                  {PLATFORMS.map(p => (
                    <button key={p.id} type="button" onClick={() => setImportPlatform(p.id)}
                      className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all
                        ${importPlatform === p.id ? `${p.color} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Input mode tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button type="button" onClick={() => setImportMode('url')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
                      ${importMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    <Link2 className="h-3 w-3" /> 貼上網址
                  </button>
                  <button type="button" onClick={() => setImportMode('text')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
                      ${importMode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    <FileText className="h-3 w-3" /> 貼上文字
                  </button>
                </div>

                {importMode === 'url' ? (
                  <div className="space-y-1">
                    <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
                      placeholder={PLATFORMS.find(p => p.id === importPlatform)?.hint ?? 'https://...'}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <p className="text-[11px] text-gray-400">若平台有防爬蟲，建議改用「貼上文字」</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <textarea value={importText} onChange={e => setImportText(e.target.value)}
                      rows={5} placeholder="在瀏覽器開啟民宿頁面 → Ctrl+A → Ctrl+C → 貼上"
                      className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
                  </div>
                )}

                {importError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs text-rose-700">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p>{importError}</p>
                      {importFetchFailed && <p className="mt-0.5 text-rose-600">請改用「貼上文字」模式</p>}
                    </div>
                  </div>
                )}

                <button type="button" onClick={startImportParse}
                  disabled={importStep === 'parsing' || (importMode === 'url' ? !importUrl.trim() : !importText.trim())}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {importStep === 'parsing'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> AI 解析中…</>
                    : <><Download className="h-4 w-4" /> 開始解析</>}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 訂房連結 */}
      <section className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5"><Link2 className="h-4 w-4" /> 前台訂房連結</h2>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-indigo-600">自訂網址識別碼（英數字、連字號）</label>
            <input value={form.slug}
              onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-bnb-name"
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        {form.slug && (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border rounded-lg px-3 py-2 text-indigo-600 truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}/book/{form.slug}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${form.slug}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="shrink-0 p-2 rounded-lg border bg-white hover:bg-indigo-50">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-indigo-500" />}
            </button>
            <a href={`/book/${form.slug}`} target="_blank" rel="noreferrer"
              className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
              預覽
            </a>
          </div>
        )}
      </section>

      {/* 基本資訊 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">基本資訊</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">民宿名稱 <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="例：宜蘭 CIAO 民宿"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">民宿介紹</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={3} placeholder="簡短描述民宿特色…"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">縣市</label>
            <input value={form.city} onChange={e => set('city', e.target.value)}
              placeholder="宜蘭縣"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">地址</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="詳細地址"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
      </section>

      {/* 聯絡方式 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">聯絡方式</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'phone',   label: '電話',      placeholder: '0912-345-678' },
            { key: 'email',   label: '聯絡 Email', placeholder: 'info@example.com' },
            { key: 'website', label: '官網',       placeholder: 'https://...' },
            { key: 'line_id', label: 'LINE ID',    placeholder: '@ciaohome' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <input value={form[key as keyof BnbProfile] as string}
                onChange={e => set(key as keyof BnbProfile, e.target.value as never)}
                placeholder={placeholder}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
        </div>
      </section>

      {/* 入住規則 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">入住規則</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">入住時間</label>
            <input value={form.check_in_time} onChange={e => set('check_in_time', e.target.value)}
              placeholder="15:00"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">退房時間</label>
            <input value={form.check_out_time} onChange={e => set('check_out_time', e.target.value)}
              placeholder="11:00"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">最少入住晚數</label>
            <input type="number" min={1} value={form.min_nights}
              onChange={e => set('min_nights', parseInt(e.target.value) || 1)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">住宿規則</label>
          <textarea value={form.house_rules} onChange={e => set('house_rules', e.target.value)}
            rows={4} placeholder="禁止吸菸、禁止攜帶寵物、請保持安靜…"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
      </section>

      {/* 早餐設定 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">早餐設定</h2>

        <div className="flex gap-2">
          {(['none','included','optional'] as const).map(t => (
            <button key={t} type="button" onClick={() => setBreakfast({ type: t })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                ${breakfast.type === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
              {t === 'none' ? '不提供' : t === 'included' ? '含早餐' : '早餐加購'}
            </button>
          ))}
        </div>

        {breakfast.type !== 'none' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">供應開始</label>
                <input value={breakfast.start_time} onChange={e => setBreakfast({ start_time: e.target.value })}
                  placeholder="07:30"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">供應結束</label>
                <input value={breakfast.end_time} onChange={e => setBreakfast({ end_time: e.target.value })}
                  placeholder="09:30"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            {breakfast.type === 'optional' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">加購價格（/人）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={breakfast.price_per_person}
                    onChange={e => setBreakfast({ price_per_person: parseFloat(e.target.value) || 0 })}
                    placeholder="200"
                    className="w-32 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <span className="text-xs text-gray-400">元/人</span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">早餐說明</label>
              <textarea value={breakfast.description}
                onChange={e => setBreakfast({ description: e.target.value })}
                rows={2} placeholder="西式早餐，含咖啡或茶…"
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        )}
      </section>

      {/* 加購服務 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">加購服務</h2>
        <p className="text-xs text-gray-400">開啟後，填寫訂單時可幫旅客勾選加購項目</p>
        <div className="divide-y">
          {addon_services.map(svc => (
            <div key={svc.id} className="py-3 space-y-2">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => updateAddon(svc.id, { enabled: !svc.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0
                    ${svc.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                    ${svc.enabled ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">{svc.name}</span>
              </div>
              {svc.enabled && (
                <div className="ml-[52px] grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">價格</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={svc.price}
                        onChange={e => updateAddon(svc.id, { price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      <span className="text-xs text-gray-400 shrink-0">元</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">計費單位</label>
                    <select value={svc.unit} onChange={e => updateAddon(svc.id, { unit: e.target.value as AddonService['unit'] })}
                      className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white">
                      {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[11px] text-gray-500">備註</label>
                    <input value={svc.note} onChange={e => updateAddon(svc.id, { note: e.target.value })}
                      placeholder="例：需提前24小時預約"
                      className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 民宿照片 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">民宿照片</h2>
        <p className="text-xs text-gray-400">上傳民宿整體環境照片，第一張為主圖</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {form.images.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden border group">
              <img src={url} alt={`photo-${i}`} className="w-full h-full object-cover" />
              {i === 0 ? (
                <span className="absolute top-1 left-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">主圖</span>
              ) : (
                <button onClick={() => setCover(url)}
                  className="absolute bottom-1 left-1 right-1 text-[10px] bg-black/60 text-white py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  設為主圖
                </button>
              )}
              <button onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-indigo-400 transition-colors">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ImagePlus className="h-5 w-5 text-gray-400" />}
            <span className="text-[10px] text-gray-400">{uploading ? '上傳中…' : '新增照片'}</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
      </section>

      <div className="text-xs text-gray-400 pb-4">
        民宿名稱會用於 Email 擷取時自動識別訂單來源，請確保與各平台上的名稱一致。
      </div>

      {/* 底部固定儲存列：有未儲存變更時出現，免捲回頂部 */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-amber-600">有未儲存的變更</span>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              儲存變更
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
