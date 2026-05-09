'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Plus, ChevronDown, Loader2, CheckCircle2, AlertCircle,
  XCircle, RefreshCw, Globe, Map, Star, Target, Newspaper, Settings,
  FileText, X, Download, Sparkles, Wand2, Volume2, PhoneCall, PhoneOff, Zap,
  Bell, ShoppingBag, Smartphone, TrendingUp,
  MoreHorizontal, Pencil, Trash2, Check, AlertTriangle, ClipboardList,
  PieChart, Clock as ClockIcon, ThumbsUp, MessageSquare as MessageSquareIcon,
} from 'lucide-react'
import DriveImagePicker from '@/components/marketing/DriveImagePicker'

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

interface Campaign {
  id: string
  title: string
  status: string
  updated_at: string
}

interface UnitDef {
  id: number
  name: string
  icon: React.ElementType
  desc: string
  implemented: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS: UnitDef[] = [
  { id: 1,  name: '蒐集資訊',  icon: Search,     desc: '新聞、網頁、地圖、評論',         implemented: true  },
  { id: 2,  name: '公司資料',  icon: Building2,  desc: '基本資料、素材上傳',             implemented: true  },
  { id: 3,  name: '分析資料',  icon: BarChart3,  desc: '市場、競爭對手、影片/文案分析',   implemented: true  },
  { id: 4,  name: '文案產出',  icon: PenLine,    desc: '行銷文案 AI 生成',              implemented: true  },
  { id: 5,  name: '圖片腳本',  icon: ImageIcon,  desc: '圖片描述腳本生成',              implemented: true  },
  { id: 6,  name: '圖片產出',  icon: ImageIcon,  desc: '行銷圖片 AI 生成',              implemented: true  },
  { id: 7,  name: '影片腳本',  icon: Film,       desc: '分鏡腳本生成',                 implemented: true  },
  { id: 8,  name: '影片產出',  icon: Video,      desc: '行銷影片 AI 生成',              implemented: true  },
  { id: 9,  name: '上傳平台',  icon: Upload,     desc: 'FB/IG/YouTube 等自動上傳',      implemented: true  },
  { id: 11, name: '主播行銷',  icon: Mic,        desc: 'HeyGen 虛擬主播影片',          implemented: true  },
]

const SIDE_TOOLS: (UnitDef & { href: string | null })[] = []

interface CollectSubOption { id: string; label: string }
interface CollectTypeDef {
  id: CollectType
  label: string
  emoji: string
  desc: string
  subOptions: CollectSubOption[]
  needsLocation?: boolean
  needsCountry?: boolean
  needsAppIds?: boolean
  needsRssUrls?: boolean
}

const COLLECT_TYPE_DEFS: CollectTypeDef[] = [
  {
    id: 'map', label: '地圖搜尋', emoji: '🗺️',
    desc: '組織: 公司/門市等',
    needsLocation: true,
    subOptions: [
      { id: 'info',        label: '基本資訊 (名稱/地址/電話)' },
      { id: 'coordinates', label: '經緯度/距離計算' },
      { id: 'reviews',     label: 'MAP 評論' },
      { id: 'hours',       label: '營業時間' },
    ],
  },
  {
    id: 'tiktok', label: 'TikTok', emoji: '📱',
    desc: '影音搜尋 / 評論',
    subOptions: [
      { id: 'videos',      label: '影音搜尋' },
      { id: 'comments',    label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'facebook', label: 'Facebook', emoji: '👥',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',       label: '內文' },
      { id: 'comments',    label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'instagram', label: 'Instagram', emoji: '📸',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',       label: '內文' },
      { id: 'comments',    label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'threads', label: 'Threads', emoji: '🧵',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',       label: '內文' },
      { id: 'comments',    label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'youtube', label: 'YouTube', emoji: '🎬',
    desc: '短影音 / 長影音 / 評論',
    subOptions: [
      { id: 'shorts',      label: '短影音' },
      { id: 'videos',      label: '長影音' },
      { id: 'comments',    label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'amazon', label: 'Amazon', emoji: '📦',
    desc: '產品 / 評論',
    subOptions: [
      { id: 'products',    label: '產品' },
      { id: 'reviews',     label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'shopee', label: 'Shopee', emoji: '🛒',
    desc: '產品 / 評論 (可選國家)',
    needsCountry: true,
    subOptions: [
      { id: 'products',    label: '產品' },
      { id: 'reviews',     label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'ios_android', label: 'iOS / Android', emoji: '📲',
    desc: 'App Store / Google Play 評論',
    needsAppIds: true,
    subOptions: [
      { id: 'reviews',     label: '評論' },
      { id: 'vendor_info', label: '廠商資料 (名稱/電話/Email)' },
    ],
  },
  {
    id: 'news', label: '新聞搜尋', emoji: '🔔',
    desc: 'Google Alerts RSS',
    needsRssUrls: true,
    subOptions: [],
  },
  {
    id: 'web', label: '網頁搜尋', emoji: '🌐',
    desc: 'Tavily 深度搜尋',
    subOptions: [],
  },
  {
    id: 'competitors', label: '競爭對手', emoji: '🎯',
    desc: 'Tavily 競品分析',
    subOptions: [],
  },
]

const SHOPEE_COUNTRIES = [
  { code: 'tw', label: '🇹🇼 台灣' },
  { code: 'vn', label: '🇻🇳 越南' },
  { code: 'id', label: '🇮🇩 印尼' },
  { code: 'ph', label: '🇵🇭 菲律賓' },
  { code: 'my', label: '🇲🇾 馬來西亞' },
  { code: 'th', label: '🇹🇭 泰國' },
  { code: 'sg', label: '🇸🇬 新加坡' },
  { code: 'br', label: '🇧🇷 巴西' },
  { code: 'mx', label: '🇲🇽 墨西哥' },
  { code: 'co', label: '🇨🇴 哥倫比亞' },
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
  if (status === 'idle') return null
  const cfg = {
    running: { cls: 'bg-blue-100 text-blue-700',  label: '執行中', spin: true  },
    done:    { cls: 'bg-green-100 text-green-700', label: '完成',   spin: false },
    error:   { cls: 'bg-red-100 text-red-700',     label: '錯誤',   spin: false },
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

  const toggleType = (t: CollectType) => {
    if (selectedTypes.includes(t)) {
      setSelectedTypes(prev => prev.filter(x => x !== t))
    } else {
      setSelectedTypes(prev => [...prev, t])
      const def = COLLECT_TYPE_DEFS.find(d => d.id === t)
      if (def && def.subOptions.length > 0 && !(subOptions[t]?.length)) {
        setSubOptions(prev => ({ ...prev, [t]: def.subOptions.map(s => s.id) }))
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
    if (!keywords.trim()) { setError('請輸入關鍵字'); return }
    if (selectedTypes.length === 0) { setError('請至少選一種蒐集類型'); return }
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
        <label className="block text-sm font-semibold mb-1.5">關鍵字 / 搜尋主題</label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
          placeholder="例如：火鍋餐廳、手機殼品牌、健身房..." />
      </div>

      {/* Type cards */}
      <div>
        <label className="block text-sm font-semibold mb-3">選擇蒐集管道</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COLLECT_TYPE_DEFS.map(ct => {
            const selected = selectedTypes.includes(ct.id)
            const curSubs = subOptions[ct.id] ?? ct.subOptions.map(s => s.id)
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
                    <div className="text-sm font-semibold">{ct.label}</div>
                    <div className="text-[11px] text-gray-400">{ct.desc}</div>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selected ? 'border-transparent text-white' : 'border-gray-300'
                  }`} style={selected ? { background: 'var(--primary)' } : {}}>
                    {selected && <span className="text-[10px] font-bold">✓</span>}
                  </div>
                </button>
                {/* Sub-options (only when selected and has sub-options) */}
                {selected && ct.subOptions.length > 0 && (
                  <div className="px-3 pb-2.5 pt-1 flex flex-wrap gap-x-3 gap-y-1.5 border-t"
                    style={{ borderColor: 'color-mix(in oklch, var(--primary) 20%, transparent)', background: 'color-mix(in oklch, var(--primary) 3%, transparent)' }}>
                    {ct.subOptions.map(so => (
                      <label key={so.id} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox"
                          className="rounded"
                          style={{ accentColor: 'var(--primary)' }}
                          checked={curSubs.includes(so.id)}
                          onChange={() => toggleSub(ct.id, so.id)}
                        />
                        {so.label}
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
          <div className="text-xs font-semibold text-blue-800">🗺️ 地圖搜尋設定</div>
          <div>
            <label className="block text-xs text-blue-700 mb-1">地點 / 城市 / 地址（用於定位搜尋範圍）</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="w-full h-8 px-3 rounded-lg border text-xs outline-none focus:ring-2 bg-white border-blue-200"
              placeholder="例如：台北市信義區、新北市板橋區..." />
          </div>
        </div>
      )}

      {/* Shopee country */}
      {selectedTypes.includes('shopee') && (
        <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200">
          <label className="block text-xs font-semibold text-orange-800 mb-2">🛒 Shopee 國家</label>
          <div className="flex flex-wrap gap-1.5">
            {SHOPEE_COUNTRIES.map(c => (
              <button key={c.code} type="button" onClick={() => setShopeeCountry(c.code)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                style={shopeeCountry === c.code
                  ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                  : { background: 'white', borderColor: '#e5e7eb' }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* App IDs (iOS/Android) */}
      {selectedTypes.includes('ios_android') && (
        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1.5">
          <div className="text-xs font-semibold text-purple-800">📲 App ID（App Store / Google Play，每行一個）</div>
          <textarea value={appIds} onChange={e => setAppIds(e.target.value)}
            rows={2} placeholder={'id1234567890\ncom.example.app'}
            className="w-full text-xs border border-purple-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" />
          <p className="text-[10px] text-purple-600">App Store: id 開頭數字 ID｜Google Play: package name</p>
        </div>
      )}

      {/* Google Alerts RSS (news) */}
      {selectedTypes.includes('news') && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          <div className="text-xs font-semibold text-amber-800">🔔 Google Alerts RSS URL（每行一個）</div>
          <textarea value={alertRssUrls} onChange={e => setAlertRssUrls(e.target.value)}
            rows={3} placeholder={'https://www.google.com/alerts/feeds/XXXXX/XXXXX\nhttps://...'}
            className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          <p className="text-[10px] text-amber-700">前往 google.com/alerts → 管理 → 訂閱 → 選「RSS 訂閱」後複製 URL</p>
        </div>
      )}

      {/* Settings row */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-gray-500">每類資料筆數</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
            {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} 筆</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5 text-gray-500">語言</label>
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
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />蒐集中，請稍候…</> : <><Search className="h-4 w-4" />開始蒐集</>}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-b pb-2">
            <span className="text-sm font-semibold text-gray-800">蒐集結果</span>
            <div className="flex gap-1">
              {(['summary', 'raw'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {t === 'summary' ? 'AI 摘要' : '原始資料'}
                </button>
              ))}
            </div>
            <button onClick={run} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> 重新蒐集
            </button>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border max-h-[520px] overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
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

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <Upload className="h-5 w-5 text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-500">點擊上傳</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{accept.replace(/,/g, ' / ')}</p>
      </div>
      <input
        ref={inputRef} type="file" multiple className="hidden" accept={accept}
        onChange={e => { Array.from(e.target.files ?? []).forEach(f => onUpload(f, category)); e.target.value = '' }}
      />
      {catFiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {catFiles.map(f => (
            <div key={f.url} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
              {f.mimeType.startsWith('image/') ? (
                <img src={f.url} alt={f.name} className="h-8 w-8 object-cover rounded flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-gray-400">{f.sizeKb} KB {f.textContent ? '· 已萃取文字' : ''}</div>
              </div>
              <button type="button" onClick={() => onRemove(f.url)} className="text-gray-300 hover:text-red-400 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 上傳中…
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
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">基本資料</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('companyName', '公司名稱 *', '例如：台灣科技股份有限公司')}
          <div>
            <label className="block text-sm font-medium mb-1.5">產業別</label>
            <select value={form.industry ?? ''} onChange={e => set('industry', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              <option value="">請選擇</option>
              {INDUSTRY_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">員工人數</label>
            <select value={form.employees ?? ''} onChange={e => set('employees', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              <option value="">請選擇</option>
              {EMPLOYEE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          {field('capital', '資本額', '例如：新台幣 1,000 萬元')}
          {field('founded', '成立年份', '例如：2010')}
          {field('website', '官方網站', 'https://www.example.com')}
        </div>
        <div className="mt-4">
          {field('address', '公司地址', '縣市 + 區 + 街道')}
        </div>
      </section>

      {/* Business Description */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">業務描述</h3>
        <div className="space-y-4">
          {field('description', '公司簡介', '簡述公司背景、發展歷程、核心價值…', true)}
          {field('products', '主要產品 / 服務', '描述主要產品或服務項目、特色功能…', true)}
          {field('targetAudience', '目標客群', '描述主要客戶群體、年齡層、消費習慣…', true)}
          {field('competitiveAdvantage', '核心競爭優勢', '相較競爭對手，公司最大的優勢是…', true)}
        </div>
      </section>

      {/* Brand */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">品牌設定</h3>
        <div>
          <label className="block text-sm font-medium mb-2">品牌語調</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map(t => (
              <button key={t} type="button" onClick={() => set('brandTone', t)}
                className="px-3 py-1.5 rounded-lg text-sm border transition-all"
                style={form.brandTone === t
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                  : {}}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section>
        <div className="flex items-center justify-between pb-2 border-b mb-4">
          <h3 className="text-sm font-bold text-gray-700">門市 / 分公司</h3>
          <button type="button"
            onClick={() => { setEditingBranch(emptyBranch()); setShowBranchForm(true) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors">
            <Plus className="h-3.5 w-3.5" />新增門市
          </button>
        </div>

        {branches.length === 0 && !showBranchForm && (
          <p className="text-xs text-gray-400 py-4 text-center">尚未新增任何門市，點擊「新增門市」開始建立</p>
        )}

        <div className="space-y-2">
          {branches.map(b => (
            <div key={b.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-gray-50">
              <Map className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{b.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{b.address}</div>
                {b.phone && <div className="text-xs text-gray-400">{b.phone}</div>}
                {b.notes && <div className="text-xs text-gray-400 italic">{b.notes}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button" onClick={() => { setEditingBranch(b); setShowBranchForm(true) }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => deleteBranch(b.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500">
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
                <label className="block text-xs font-medium mb-1">門市名稱 *</label>
                <input value={editingBranch.name}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  placeholder="例如：台北信義門市"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">電話</label>
                <input value={editingBranch.phone ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                  placeholder="例如：02-1234-5678"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">地址 *</label>
              <input value={editingBranch.address}
                onChange={e => setEditingBranch(prev => prev ? { ...prev, address: e.target.value } : prev)}
                placeholder="例如：台北市信義區信義路五段7號"
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">緯度（選填）</label>
                <input type="number" value={editingBranch.lat ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, lat: e.target.value ? Number(e.target.value) : undefined } : prev)}
                  placeholder="25.033964"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">經度（選填）</label>
                <input type="number" value={editingBranch.lng ?? ''}
                  onChange={e => setEditingBranch(prev => prev ? { ...prev, lng: e.target.value ? Number(e.target.value) : undefined } : prev)}
                  placeholder="121.564468"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">備註</label>
              <input value={editingBranch.notes ?? ''}
                onChange={e => setEditingBranch(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                placeholder="例如：週末延長營業"
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button"
                onClick={() => { if (editingBranch.name && editingBranch.address) saveBranch(editingBranch) }}
                disabled={!editingBranch.name || !editingBranch.address}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'var(--primary)' }}>
                <Check className="h-3.5 w-3.5" />儲存門市
              </button>
              <button type="button"
                onClick={() => { setShowBranchForm(false); setEditingBranch(null) }}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">
                取消
              </button>
            </div>
          </div>
        )}

        {branches.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            共 {branches.length} 個門市。可輸入經緯度以啟用最近門市計算功能。
          </p>
        )}
      </section>

      {/* Files */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">素材上傳</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FileUploadZone category="logo" label="Logo / 品牌標誌"
            accept=".jpg,.jpeg,.png,.svg,.webp" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="image" label="產品 / 情境圖片"
            accept=".jpg,.jpeg,.png,.webp,.gif" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="document" label="公司簡介 / 型錄"
            accept=".pdf,.docx,.doc,.txt" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
          <FileUploadZone category="faq" label="FAQ / 對答資料"
            accept=".xlsx,.xls,.csv,.docx,.doc,.txt" files={files} uploading={uploading}
            onUpload={handleUpload} onRemove={handleRemove} />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Excel/Word/PDF 文件將自動萃取文字，供 AI 分析與客服回覆使用。
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
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : <><CheckCircle2 className="h-4 w-4" />儲存公司資料</>}
        </button>
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />已儲存</span>}
      </div>

      {/* Stats preview */}
      {(form.companyName || files.length > 0 || branches.length > 0) && (
        <div className="p-4 rounded-xl bg-gray-50 border">
          <div className="text-xs font-medium text-gray-500 mb-3">資料概覽</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '公司名稱', value: form.companyName || '—' },
              { label: '產業', value: form.industry || '—' },
              { label: '品牌語調', value: form.brandTone || '—' },
              { label: '員工人數', value: form.employees || '—' },
              { label: '門市數量', value: branches.length > 0 ? `${branches.length} 間` : '—' },
              { label: '含經緯度', value: branches.filter(b => b.lat && b.lng).length > 0 ? `${branches.filter(b => b.lat && b.lng).length} 間` : '—' },
              { label: '上傳檔案', value: `${files.length} 份` },
              { label: '文字素材', value: `${files.filter(f => f.textContent).length} 份已萃取` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xs font-bold text-gray-800 truncate">{s.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
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
}

const ANALYSIS_TYPE_DEFS: { id: AnalysisType; label: string; desc: string }[] = [
  { id: 'swot',                  label: 'SWOT 分析',         desc: '優勢/劣勢/機會/威脅全面評估' },
  { id: 'company',               label: '公司分析',           desc: '業態、規模、營業情況、風險' },
  { id: 'competitor_activity',   label: '競爭對手活動分析',    desc: '競品行銷手法、渠道、內容' },
  { id: 'competitor_performance',label: '競爭對手業績分析',    desc: '市場份額、定價、客戶口碑' },
  { id: 'content',               label: '影片/文案擷取分析',   desc: '競品內容策略、高績效內容特徵' },
  { id: 'marketing',             label: '行銷文案分析',        desc: '文案風格趨勢、訴求點、關鍵字' },
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
  unit1Data?: { summary?: string; raw?: string }
  unit2Data?: Unit2Data
  onDone: (data: Unit3Data) => void
}) {
  const [selectedTypes, setSelectedTypes] = useState<AnalysisType[]>(
    savedData?.types ?? ['swot', 'marketing']
  )
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit3Data | null>(savedData?.results ? savedData : null)
  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    if (result?.types?.length && !activeTab) setActiveTab(result.types[0])
  }, [result, activeTab])

  const toggleType = (t: AnalysisType) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const run = async () => {
    if (selectedTypes.length === 0) { setError('請至少選一種分析類型'); return }
    setRunning(true); setError('')
    try {
      const res = await fetch('/api/marketing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: selectedTypes,
          collectedData: unit1Data?.summary ?? '',
          companyData: unit2Data ?? {},
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit3Data = { types: selectedTypes, results: data.results, metrics: data.metrics }
      setResult(out)
      setActiveTab(selectedTypes[0])
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const hasUnit1 = !!unit1Data?.summary
  const hasUnit2 = !!unit2Data?.companyName

  return (
    <div className="space-y-6">
      {/* Data source status */}
      <div className="flex gap-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${hasUnit1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
          {hasUnit1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          單元1 蒐集資料 {hasUnit1 ? '已載入' : '尚未執行'}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${hasUnit2 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
          {hasUnit2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          單元2 公司資料 {hasUnit2 ? `(${unit2Data?.companyName})` : '尚未填寫'}
        </div>
      </div>

      {/* Analysis type selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">選擇分析項目</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANALYSIS_TYPE_DEFS.map(at => {
            const selected = selectedTypes.includes(at.id)
            return (
              <button key={at.id} type="button" onClick={() => toggleType(at.id)}
                className="flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all"
                style={selected
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                  : { borderColor: '#e5e7eb' }}>
                <div className={`w-4 h-4 rounded border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${selected ? 'border-0' : 'border-gray-300'}`}
                  style={selected ? { background: 'var(--primary)' } : {}}>
                  {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{at.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{at.desc}</div>
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
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />Gemini 分析中，請稍候…</> : <><BarChart3 className="h-4 w-4" />開始分析</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Metrics */}
          {result.metrics && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '市場機會指數', value: `${result.metrics.opportunity}/100`, color: 'text-green-600' },
                { label: '競品數量',     value: `${result.metrics.competitors} 家`,  color: 'text-blue-600' },
                { label: '目標受眾',     value: result.metrics.audience,             color: 'text-purple-600' },
                { label: '競爭力評分',   value: `${result.metrics.score}/100`,       color: 'text-amber-600' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-xl bg-gray-50 text-center border">
                  <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tab selector */}
          {result.types && result.types.length > 1 && (
            <div className="flex gap-1.5 flex-wrap border-b pb-2">
              {result.types.map(t => {
                const def = ANALYSIS_TYPE_DEFS.find(d => d.id === t)
                return (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {def?.label ?? t}
                  </button>
                )
              })}
            </div>
          )}

          {/* Content */}
          {activeTab && result.results?.[activeTab] && (
            <div className="p-5 rounded-xl bg-gray-50 border max-h-[550px] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500">
                  {ANALYSIS_TYPE_DEFS.find(d => d.id === activeTab)?.label} — Gemini 1.5 Flash
                </span>
                <button onClick={run} disabled={running}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RefreshCw className="h-3.5 w-3.5" /> 重新分析
                </button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {result.results[activeTab]}
              </pre>
            </div>
          )}
        </div>
      )}
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

const COPY_TYPE_DEFS: { id: CopyType; label: string; group: string }[] = [
  { id: 'facebook_post',       label: 'Facebook 貼文',    group: '社群' },
  { id: 'instagram_caption',   label: 'Instagram 說明',   group: '社群' },
  { id: 'threads_post',        label: 'Threads 貼文',     group: '社群' },
  { id: 'line_message',        label: 'LINE 訊息',        group: '社群' },
  { id: 'twitter_post',        label: 'Twitter/X 推文',  group: '社群' },
  { id: 'linkedin_post',       label: 'LinkedIn 貼文',    group: '社群' },
  { id: 'youtube_description', label: 'YouTube 說明欄',   group: '影片' },
  { id: 'ad_headline',         label: '廣告標題組',        group: '廣告' },
  { id: 'email_subject',       label: 'Email 主旨',       group: '電郵' },
  { id: 'email_body',          label: 'Email 內文',       group: '電郵' },
  { id: 'press_release',       label: '新聞稿',           group: '其他' },
  { id: 'anchor_script',       label: '🎙️ 主播口播腳本',  group: '主播' },
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
  unit1Data?: { summary?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  onDone: (data: Unit4Data) => void
}) {
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

  const toggleType = (t: CopyType) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const run = async (fb?: string) => {
    if (selectedTypes.length === 0) { setError('請至少選一種文案類型'); return }
    setRunning(true); setError('')
    try {
      const regularTypes = selectedTypes.filter(t => t !== 'anchor_script')
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
          }),
        })
        const data = await res.json()
        if (data.scripts?.[0]) {
          results['anchor_script'] = data.scripts[0]
        } else if (data.error) {
          throw new Error(`主播文案生成失敗：${data.error}`)
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
          { label: '蒐集資料', ok: !!unit1Data?.summary },
          { label: '公司資料', ok: !!unit2Data?.companyName },
          { label: '分析資料', ok: !!unit3Data?.results },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Copy type selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">選擇文案類型</label>
        {groups.map(g => (
          <div key={g} className="mb-3">
            <div className="text-xs font-medium text-gray-400 mb-1.5">{g}</div>
            <div className="flex flex-wrap gap-2">
              {COPY_TYPE_DEFS.filter(d => d.group === g).map(d => {
                const sel = selectedTypes.includes(d.id)
                return (
                  <button key={d.id} type="button" onClick={() => toggleType(d.id)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                    style={sel
                      ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                      : {}}>
                    {d.label}
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
            <span className="font-semibold text-sm text-indigo-800">🎙️ 主播口播腳本設定</span>
            <span className="text-[10px] text-indigo-500 ml-1">（此腳本將直接用於 Unit 11 主播影片生成）</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-indigo-700 block mb-1">影片時長</label>
              <select value={anchorDuration} onChange={e => setAnchorDuration(Number(e.target.value))}
                className="w-full text-sm border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {[15,30,60,90,120,180,300].map(s => (
                  <option key={s} value={s}>{s} 秒（約 {Math.round(s * 4.5)} 字）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-indigo-700 block mb-1">口播風格</label>
              <select value={anchorStyle} onChange={e => setAnchorStyle(e.target.value)}
                className="w-full text-sm border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {['專業親切','熱情活力','沉穩信任','輕鬆幽默','商務正式'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-indigo-600">
            生成後 Unit 11 主播行銷會自動使用此腳本，無需重新輸入。
          </p>
        </div>
      )}

      {/* User instructions */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          使用者特別規定
          <span className="ml-2 text-xs font-normal text-gray-400">（選填，可指定風格、禁用字詞、必帶訊息等）</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="例如：禁止使用『最好』『最強』等誇大字眼；必須提及限時優惠；文案要帶有緊迫感…" />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={() => run()} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running ? <><Loader2 className="h-4 w-4 animate-spin" />Claude 生成中…</> : <><PenLine className="h-4 w-4" />產生文案</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex gap-1.5 flex-wrap border-b pb-2">
            {result.types?.map(t => {
              const def = COPY_TYPE_DEFS.find(d => d.id === t)
              return (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {def?.label ?? t}
                </button>
              )
            })}
          </div>

          {/* Active copy editor */}
          {activeTab && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {COPY_TYPE_DEFS.find(d => d.id === activeTab)?.label} — Claude Sonnet · 可直接編輯
                </span>
                <button onClick={() => run()} disabled={running}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RefreshCw className="h-3.5 w-3.5" /> 重新生成
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
            <div className="text-xs font-semibold text-amber-800">輸入修改意見，重新生成所有文案</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder="例如：語調太正式，改成輕鬆活潑；加入限時優惠感…"
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                重生成
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
  unit1Data?: { summary?: string }
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
          { label: '蒐集資料', ok: !!unit1Data?.summary },
          { label: '公司資料', ok: hasUnit2 },
          { label: '分析資料', ok: !!unit3Data?.results },
          { label: '文案資料', ok: hasUnit4 },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Count selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">產出圖片數量</label>
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
        <label className="block text-sm font-semibold mb-2">目標發布平台</label>
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
          特別規定
          <span className="ml-2 text-xs font-normal text-gray-400">（選填，可指定圖片風格、禁止元素、必帶資訊等）</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="例如：必須包含產品照片；風格要高端奢華；禁止使用紅色；圖片要帶有品牌 Logo 位置…" />
      </div>

      {/* Drive reference image */}
      <div className="p-4 rounded-xl border border-dashed border-gray-300 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">搭配參考圖片（選填）</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useRefImage} onChange={e => setUseRefImage(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-xs text-gray-600">啟用</span>
          </label>
        </div>
        {useRefImage && (
          <DriveImagePicker
            folderId={driveFolderId}
            folderName={driveFolderName}
            onFolderChange={onDriveFolderChange}
            onImagePicked={onDriveImagePicked}
            pickedImage={drivePickedImage ?? null}
            label="從 Google Drive 隨機取圖，腳本將配合此圖片生成"
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
          ? <><Loader2 className="h-4 w-4 animate-spin" />Claude 生成腳本中…</>
          : <><ImageIcon className="h-4 w-4" />{useRefImage && drivePickedImage ? '以參考圖片產生腳本' : '產生圖片腳本'}</>}
      </button>

      {/* Results */}
      {result && result.scripts && result.scripts.length > 0 && (
        <div className="space-y-3">
          {/* Script tab bar */}
          <div className="flex gap-1.5 flex-wrap border-b pb-2">
            {result.scripts.map(s => (
              <button key={s.id} onClick={() => setActiveScript(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeScript === s.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                圖片 {s.id}
              </button>
            ))}
            <button onClick={() => run()} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <RefreshCw className="h-3.5 w-3.5" /> 重新生成
            </button>
          </div>

          {/* Active script content */}
          {result.scripts.find(s => s.id === activeScript) && (
            <div className="p-5 rounded-xl bg-gray-50 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500">
                  圖片 {activeScript} 視覺腳本 — Claude Sonnet
                </span>
                <span className="text-[10px] text-gray-400 bg-white border rounded-full px-2 py-0.5">
                  共 {result.scripts.length} 張
                </span>
              </div>
              {useRefImage && drivePickedImage && (
                <div className="mb-3 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drivePickedImage.dataUrl} alt={drivePickedImage.name}
                    className="w-24 h-24 object-cover rounded-lg border shrink-0" />
                  <div className="text-xs text-gray-500">
                    <div className="font-medium text-gray-700 mb-0.5">參考圖片</div>
                    <div className="truncate">{drivePickedImage.name}</div>
                    <div className="text-gray-400 mt-1">腳本已根據此圖片風格生成</div>
                  </div>
                </div>
              )}
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                {result.scripts.find(s => s.id === activeScript)?.content}
              </pre>
            </div>
          )}

          {/* Feedback */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="text-xs font-semibold text-amber-800">輸入修改意見，重新生成所有腳本</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder="例如：風格改成更年輕活潑；加入更多產品細節；色調改為暖色系…"
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                重生成
              </button>
            </div>
          </div>

          {/* Copy AI prompt hint */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1">💡 使用提示</div>
            <div className="text-xs text-blue-600">
              每張腳本末尾的 <strong>AI 生成 Prompt</strong> 可直接複製至 Midjourney、DALL-E 3、Stable Diffusion 等工具生成圖片。
              完成後前往 <strong>單元6 圖片產出</strong> 進行 AI 生成。
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

const IMAGE_MODELS: { id: ImageModel; name: string; desc: string; cost: string; badge: string }[] = [
  { id: 'flux',   name: 'FLUX.1 Pro',   desc: '高品質寫實，最適合行銷圖',    cost: '$0.05/張', badge: '推薦'   },
  { id: 'dalle3', name: 'DALL-E 3',     desc: '語意理解強，圖中文字清晰',    cost: '$0.08/張', badge: 'OpenAI' },
  { id: 'nano',   name: 'Nano Banana',  desc: '速度快，適合快速草稿預覽',    cost: '$0.02/張', badge: '快速'   },
]

const SIZE_OPTIONS = [
  { value: '1:1',  label: '1:1 正方形', hint: 'IG/FB' },
  { value: '9:16', label: '9:16 直式',  hint: 'Reels/Stories' },
  { value: '16:9', label: '16:9 橫式', hint: 'YouTube/LinkedIn' },
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
    if (!prompt) { setErrors(prev => ({ ...prev, [scriptId]: 'Prompt 不可為空' })); return }
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
    if (!manualPrompt.trim()) { setManualError('請輸入 Prompt'); return }
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
        <label className="block text-sm font-semibold mb-3">選擇生成模型</label>
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
                {m.badge}
              </span>
              <span className="text-sm font-bold text-gray-800 pr-8">{m.name}</span>
              <span className="text-[10px] text-gray-400 mt-1 leading-snug">{m.desc}</span>
              <span className="text-xs font-semibold mt-2" style={{ color: 'var(--primary)' }}>{m.cost}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Image settings */}
      <div className="p-4 rounded-xl bg-gray-50 border space-y-4">
        <div className="text-xs font-semibold text-gray-600">圖片設定</div>
        <div className="flex flex-wrap gap-6">
          {/* Size */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">尺寸比例</div>
            <div className="flex gap-2">
              {SIZE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSize(opt.value)}
                  className="flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all"
                  style={size === opt.value
                    ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                    : { background: 'white' }}>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {/* DALL-E 3 only options */}
          {model === 'dalle3' && (
            <>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">品質</div>
                <div className="flex gap-2">
                  {(['standard', 'hd'] as const).map(q => (
                    <button key={q} onClick={() => setQuality(q)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={quality === q
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : { background: 'white' }}>
                      {q === 'standard' ? '標準' : 'HD 高清'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">風格</div>
                <div className="flex gap-2">
                  {(['vivid', 'natural'] as const).map(st => (
                    <button key={st} onClick={() => setStyle(st)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                      style={style === st
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : { background: 'white' }}>
                      {st === 'vivid' ? '鮮豔生動' : '自然寫實'}
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
            參考圖片（img2img）
          </div>
          <button onClick={() => setUseRefImg(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all"
            style={useRefImg
              ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
              : { background: 'white' }}>
            {useRefImg ? '已啟用' : '使用參考圖片生成'}
          </button>
        </div>
        {useRefImg && (
          <DriveImagePicker
            folderId={driveFolderId}
            folderName={driveFolderName}
            onFolderChange={onDriveFolderChange}
            onImagePicked={onDriveImagePicked}
            pickedImage={drivePickedImage ?? null}
            label="圖片生成參考圖"
          />
        )}
        {useRefImg && drivePickedImage && (
          <p className="text-[10px] text-blue-600">已選擇參考圖片，所有圖片將以此圖風格生成（img2img）</p>
        )}
        {!useRefImg && (
          <p className="text-[10px] text-blue-500">啟用後可從 Google Drive 選取圖片作為生成基礎，實現 img2img 效果</p>
        )}
      </div>

      {/* Scripts from Unit 5 */}
      {hasUnit5 ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-gray-700">
            從單元5腳本生成（共 {scripts.length} 張）
          </div>
          {scripts.map(s => {
            const img = images.find(i => i.scriptId === s.id)
            const isGen = generating[s.id]
            const err = errors[s.id]
            const modelLabel = IMAGE_MODELS.find(m => m.id === img?.model)?.name ?? img?.model
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">圖片 {s.id}</span>
                  {img && (
                    <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      已生成 · {modelLabel}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      AI 生成 Prompt <span className="text-gray-400 font-normal">（可編輯）</span>
                    </label>
                    <textarea
                      value={prompts[s.id] ?? ''}
                      onChange={e => {
                        setUserEditedPrompts6(prev => new Set(prev).add(s.id))
                        setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))
                      }}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none font-mono"
                      placeholder="輸入英文 Prompt…"
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
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{modelInfo.name} 生成中…</>
                        : <><Sparkles className="h-3.5 w-3.5" />{img ? '重新生成' : `用 ${modelInfo.name} 生成`}</>}
                    </button>
                    {img && (
                      <span className="text-[10px] text-gray-400">
                        {img.size} · {modelInfo.cost} · {new Date(img.generatedAt).toLocaleTimeString('zh-TW')}
                      </span>
                    )}
                  </div>
                  {img && (
                    <div className="relative rounded-xl overflow-hidden border bg-gray-50">
                      <img src={img.url} alt={`圖片 ${s.id}`} className="w-full object-contain max-h-96" />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <a href={img.url} download={`img-${s.id}.png`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] hover:bg-black/80">
                          <Download className="h-3 w-3" /> 下載
                        </a>
                        <button onClick={() => removeImage(img.url)}
                          className="p-1 rounded-lg bg-black/60 text-white hover:bg-black/80">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {img.revisedPrompt && img.revisedPrompt !== img.prompt && (
                        <div className="px-3 py-2 bg-gray-50 border-t">
                          <div className="text-[10px] text-gray-500 font-medium mb-0.5">模型修訂 Prompt：</div>
                          <div className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{img.revisedPrompt}</div>
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
          <strong>尚未執行單元5（圖片腳本）</strong>，可直接在下方輸入自訂 Prompt 生成圖片。
        </div>
      )}

      {/* Manual prompt */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Wand2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          手動輸入 Prompt
        </div>
        <textarea value={manualPrompt} onChange={e => setManualPrompt(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none font-mono"
          placeholder="輸入英文 Prompt，例如：Professional marketing photo of luxury skincare products on white marble..." />
        {manualError && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{manualError}
          </div>
        )}
        <button onClick={generateManual} disabled={manualGenerating || !manualPrompt.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {manualGenerating
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />生成中…</>
            : <><Sparkles className="h-3.5 w-3.5" />用 {modelInfo.name} 生成</>}
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
            已生成 {images.length} 張圖片，儲存於 Supabase Storage，可於單元9上傳至各平台。
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
  { id: 'youtube',         label: 'YouTube 一般' },
]

const VIDEO_TYPES: { id: string; label: string; desc: string }[] = [
  { id: 'short_video',  label: '短影音',   desc: '直接吸睛，快節奏' },
  { id: 'ad',           label: '廣告影片', desc: 'AIDA 結構，促轉換' },
  { id: 'tutorial',     label: '教學影片', desc: '示範產品/服務使用' },
  { id: 'testimonial',  label: '客戶見證', desc: '真實口碑，建立信任' },
  { id: 'brand_story',  label: '品牌故事', desc: '情感連結，品牌形象' },
]

const DURATION_OPTIONS = [
  { value: '5',  label: '5秒',  hint: 'KLING' },
  { value: '10', label: '10秒', hint: 'KLING' },
  { value: '25', label: '25秒', hint: 'Google VEO3' },
  { value: '60', label: '60秒', hint: 'SORA' },
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
  unit1Data?: { summary?: string }
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
    if (videoTypes.length === 0) { setError('請至少選一種影片類型'); return }
    if (platforms.length === 0) { setError('請至少選一個平台'); return }
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
          { label: '蒐集資料', ok: !!unit1Data?.summary },
          { label: '公司資料', ok: !!unit2Data?.companyName },
          { label: '分析資料', ok: !!unit3Data?.results },
          { label: '文案資料', ok: !!unit4Data?.results },
          { label: '圖片腳本', ok: !!(unit5Data?.scripts?.length) },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* Count */}
      <div>
        <label className="block text-sm font-semibold mb-2">產出影片數量</label>
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
        <label className="block text-sm font-semibold mb-2">影片時長</label>
        <div className="flex gap-2 flex-wrap">
          {DURATION_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDuration(opt.value)}
              className="flex flex-col items-center px-4 py-2 rounded-lg border text-xs transition-all"
              style={duration === opt.value
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              <span className="font-semibold">{opt.label}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Video type */}
      <div>
        <label className="block text-sm font-semibold mb-2">影片類型</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VIDEO_TYPES.map(vt => {
            const sel = videoTypes.includes(vt.id)
            return (
              <button key={vt.id} onClick={() => toggleType(vt.id)}
                className="flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                style={sel
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                  : { borderColor: '#e5e7eb' }}>
                <div className={`w-4 h-4 rounded border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${sel ? 'border-0' : 'border-gray-300'}`}
                  style={sel ? { background: 'var(--primary)' } : {}}>
                  {sel && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-medium">{vt.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{vt.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Platform */}
      <div>
        <label className="block text-sm font-semibold mb-2">目標發布平台</label>
        <div className="flex flex-wrap gap-2">
          {VIDEO_PLATFORMS.map(p => {
            const sel = platforms.includes(p.id)
            return (
              <button key={p.id} onClick={() => togglePlatform(p.id)}
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

      {/* Reference image */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            參考圖片（提供給 Claude Vision）
          </div>
          <button onClick={() => setUseRefImage(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all"
            style={useRefImage
              ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
              : { background: 'white' }}>
            {useRefImage ? '已啟用' : '使用參考圖片'}
          </button>
        </div>
        {!useRefImage && (
          <p className="text-[10px] text-blue-500">啟用後 Claude 會根據圖片場景與風格生成更貼切的腳本</p>
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
                單元6 生成圖片
              </button>
            </div>
            {refImageSource === 'drive' && (
              <DriveImagePicker
                folderId={driveFolderId}
                folderName={driveFolderName}
                onFolderChange={onDriveFolderChange}
                onImagePicked={onDriveImagePicked}
                pickedImage={drivePickedImage ?? null}
                label="影片腳本參考圖"
              />
            )}
            {refImageSource === 'unit6' && (
              unit6Images.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-blue-600">選擇一張單元6已生成的圖片作為參考</p>
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
                <p className="text-xs text-blue-600">尚未在單元6生成圖片，請先完成單元6或改用 Drive 圖片。</p>
              )
            )}
          </>
        )}
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          特別規定
          <span className="ml-2 text-xs font-normal text-gray-400">（選填）</span>
        </label>
        <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="例如：必須出現產品特寫；旁白要用台語；開頭用問句勾起好奇心…" />
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
              ? <><Loader2 className="h-4 w-4 animate-spin" />Claude 生成腳本中…</>
              : <><Film className="h-4 w-4" />{hasRef ? '以參考圖片產生腳本' : '產生影片腳本'}</>}
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
                  activeScript === s.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                影片 {s.id}
              </button>
            ))}
            <button onClick={() => run()} disabled={running}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <RefreshCw className="h-3.5 w-3.5" /> 重新生成
            </button>
          </div>

          {/* Active script */}
          {result.scripts.find(s => s.id === activeScript) && (
            <div className="p-5 rounded-xl bg-gray-50 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500">
                  影片 {activeScript} 分鏡腳本 — Claude Sonnet · {result.duration}秒
                </span>
                <span className="text-[10px] text-gray-400 bg-white border rounded-full px-2 py-0.5">
                  共 {result.scripts.length} 支
                </span>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[600px] overflow-y-auto">
                {result.scripts.find(s => s.id === activeScript)?.content}
              </pre>
            </div>
          )}

          {/* Feedback */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
            <div className="text-xs font-semibold text-amber-800">輸入修改意見，重新生成所有腳本</div>
            <div className="flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
                placeholder="例如：節奏太慢；開頭不夠吸引人；加入更多產品細節…"
                onKeyDown={e => e.key === 'Enter' && feedback.trim() && run(feedback)}
              />
              <button onClick={() => run(feedback)} disabled={!feedback.trim() || running}
                className="px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                重生成
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-700 font-medium mb-1">💡 使用提示</div>
            <div className="text-xs text-blue-600">
              腳本完成後，前往 <strong>單元8 影片產出</strong> 使用 KLING（5/10秒）、Google VEO3（25秒）或 SORA（60秒）將腳本轉換為實際影片。
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

const VIDEO_MODEL_LABELS: Record<VideoModel, string> = {
  'kling-standard':  'KLING Standard',
  'kling-pro':       'KLING Pro',
  'kling-img2video': 'KLING 圖生影片',
  'veo3':            'Google VEO3',
  'veo3-img2video':  'VEO3 圖生影片',
  'sora':            'SORA',
  'sora-img2video':  'SORA 圖生影片',
}

const DURATION_CARDS: { duration: VideoDuration; provider: string; badge: string; hint: string }[] = [
  { duration: '5',  provider: 'KLING', badge: '5秒',  hint: '超短 · 快速' },
  { duration: '10', provider: 'KLING', badge: '10秒', hint: '短影音' },
  { duration: '25', provider: 'Google VEO3', badge: '25秒', hint: '中長影音' },
  { duration: '60', provider: 'SORA',  badge: '60秒', hint: '長影片' },
]

function resolveModel(duration: VideoDuration, klingQuality: 'standard' | 'pro', useImg2Video: boolean): VideoModel {
  if (duration === '5' || duration === '10') {
    if (useImg2Video) return 'kling-img2video'
    return klingQuality === 'pro' ? 'kling-pro' : 'kling-standard'
  }
  if (duration === '25') return useImg2Video ? 'veo3-img2video' : 'veo3'
  return useImg2Video ? 'sora-img2video' : 'sora'
}

function generatingLabel(model: VideoModel): string {
  if (model.startsWith('kling')) return 'KLING 生成中…'
  if (model.startsWith('veo3')) return 'VEO3 生成中…'
  return 'SORA 生成中…'
}

const VIDEO_ASPECT_OPTIONS = [
  { value: '16:9', label: '16:9 橫式', hint: 'YouTube/FB' },
  { value: '9:16', label: '9:16 直式', hint: 'Reels/TikTok' },
  { value: '1:1',  label: '1:1 正方形', hint: 'IG/通用' },
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
      setJobs(prev => ({ ...prev, [scriptId]: { scriptId, requestId: '', model, status: 'failed', error: '影片 Prompt 不可為空，請先完成單元 7 腳本或手動輸入描述' } }))
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
        <label className="block text-sm font-semibold mb-3">選擇影片時長</label>
        <div className="grid grid-cols-4 gap-3">
          {DURATION_CARDS.map(card => (
            <button key={card.duration} onClick={() => { setDuration(card.duration); setUseImg2Video(false) }}
              className="relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
              style={duration === card.duration
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                : { borderColor: '#e5e7eb', background: 'white' }}>
              <span className="text-base font-bold text-gray-800">{card.badge}</span>
              <span className="text-[11px] font-semibold mt-1"
                style={{ color: duration === card.duration ? 'var(--primary)' : '#6b7280' }}>
                {card.provider}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5">{card.hint}</span>
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
                {q === 'standard' ? 'Standard（較快）' : 'Pro（旗艦品質）'}
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
            圖片生成影片
          </button>
          <span className="text-[10px] text-gray-400">使用單元6圖片作為起始畫面</span>
        </div>

        <div className="mt-2 text-[10px] text-gray-400">
          目前模型：<span className="font-semibold text-gray-600">{VIDEO_MODEL_LABELS[model]}</span>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 rounded-xl bg-gray-50 border space-y-4">
        <div className="text-xs font-semibold text-gray-600">影片設定</div>
        <div className="flex flex-wrap gap-6">
          {/* Aspect ratio */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">畫面比例</div>
            <div className="flex gap-2">
              {VIDEO_ASPECT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setAspectRatio(opt.value)}
                  className="flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all"
                  style={aspectRatio === opt.value
                    ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                    : { background: 'white' }}>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Image selector (img2video) */}
      {useImg2Video && (
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 space-y-3">
          <div className="text-xs font-semibold text-blue-800">選擇來源圖片</div>
          {/* Source toggle */}
          <div className="flex gap-2">
            <button onClick={() => setImg2VideoSource('unit6')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={img2VideoSource === 'unit6'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              單元6 生成圖片
            </button>
            <button onClick={() => setImg2VideoSource('drive')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={img2VideoSource === 'drive'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                : { background: 'white' }}>
              Google Drive 圖片
            </button>
          </div>
          {img2VideoSource === 'unit6' && (
            hasUnit6Images ? (
              <div className="flex gap-2 flex-wrap">
                {generatedImages.map(img => (
                  <button key={img.url} onClick={() => setSelectedImage(img.url)}
                    className="relative rounded-lg overflow-hidden border-2 transition-all"
                    style={selectedImage === img.url ? { borderColor: 'var(--primary)' } : { borderColor: 'transparent' }}>
                    <img src={img.url} alt="圖片" className="w-16 h-16 object-cover" />
                    {selectedImage === img.url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-600">尚未在單元6生成圖片。請先完成單元6，或改用 Drive 圖片。</p>
            )
          )}
          {img2VideoSource === 'drive' && (
            drivePickedImage ? (
              <div className="flex items-center gap-3">
                <img src={drivePickedImage.dataUrl} alt={drivePickedImage.name} className="w-16 h-16 object-cover rounded-lg border" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-800 truncate">{drivePickedImage.name}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">已選擇 Drive 圖片，將以此圖生成影片</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-600">尚未在單元5/6/7 選取 Google Drive 圖片，請先前往任一單元選取。</p>
            )
          )}
        </div>
      )}

      {/* From Unit 7 scripts */}
      {hasUnit7 ? (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-gray-700">從單元7腳本生成（共 {scripts.length} 支）</div>
          {scripts.map(s => {
            const job = jobs[s.id]
            const vid = videos.find(v => v.scriptId === s.id)
            const isProcessing = job?.status === 'processing'
            const isFailed = job?.status === 'failed'
            return (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
                  <Film className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">影片 {s.id}</span>
                  {vid && <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">已生成</span>}
                  {isProcessing && <span className="ml-auto text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />生成中（約1-3分鐘）</span>}
                  {isFailed && <span className="ml-auto text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">失敗</span>}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">影片 Prompt <span className="text-gray-400 font-normal">（可編輯）</span></label>
                    <textarea value={prompts[s.id] ?? ''} onChange={e => {
                        setUserEditedPrompts(prev => new Set(prev).add(s.id))
                        setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))
                      }}
                      rows={3} className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none"
                      placeholder="描述影片畫面與動作…" />
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
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{generatingLabel(model)}</>
                      : <><Sparkles className="h-3.5 w-3.5" />{vid ? '重新生成' : '生成影片'}</>}
                  </button>
                  {vid && (
                    <div className="rounded-xl overflow-hidden border bg-black">
                      <video src={vid.url} controls className="w-full max-h-72" />
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t">
                        <span className="text-[10px] text-gray-400 flex-1">{VIDEO_MODEL_LABELS[vid.model]} · {new Date(vid.generatedAt).toLocaleString('zh-TW')}</span>
                        <a href={vid.url} download={`video-${s.id}.mp4`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-200 text-gray-700 text-[10px] hover:bg-gray-300">
                          <Download className="h-3 w-3" /> 下載
                        </a>
                        <button onClick={() => removeVideo(vid.url)} className="p-1 rounded-lg text-gray-400 hover:text-red-400">
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
          <strong>尚未執行單元7（影片腳本）</strong>，可在下方直接輸入 Prompt 生成影片。
        </div>
      )}

      {/* Manual prompt */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Wand2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          手動輸入 Prompt
        </div>
        <textarea value={manualPrompt} onChange={e => setManualPrompt(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-2 resize-none"
          placeholder="描述影片畫面，例如：A woman holds a skincare product and smiles, close-up shot, warm lighting, smooth camera movement…" />
        {manualJob?.status === 'failed' && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{manualJob.error}
          </div>
        )}
        <button onClick={submitManual} disabled={manualJob?.status === 'processing' || !manualPrompt.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {manualJob?.status === 'processing'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{generatingLabel(model)}</>
            : <><Sparkles className="h-3.5 w-3.5" />生成影片</>}
        </button>
        {(() => {
          const manualVid = videos.find(v => v.scriptId === 0)
          return manualVid ? (
            <div className="rounded-xl overflow-hidden border bg-black mt-3">
              <video src={manualVid.url} controls autoPlay className="w-full max-h-72" />
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t">
                <span className="text-[10px] text-gray-400 flex-1">
                  {VIDEO_MODEL_LABELS[manualVid.model]} · {new Date(manualVid.generatedAt).toLocaleString('zh-TW')}
                </span>
                <a href={manualVid.url} download="video.mp4" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-200 text-gray-700 text-[10px] hover:bg-gray-300">
                  <Download className="h-3 w-3" /> 下載
                </a>
                <button onClick={() => removeVideo(manualVid.url)} className="p-1 rounded-lg text-gray-400 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null
        })()}
      </div>

      {/* Notice */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
        <strong>注意：</strong>影片生成通常需要 <strong>1-3 分鐘</strong>，提交後頁面會自動每 6 秒輪詢狀態，請勿離開此頁面。生成完成後影片將自動顯示。
      </div>

      {videos.length > 0 && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium">已生成 {videos.length} 支影片，可於單元9上傳至各平台。</span>
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

  const toggleImgPlatform = (id: string) =>
    setSelectedImagePlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleVidPlatform = (id: string) =>
    setSelectedVideoPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const allSelected = [...selectedImagePlatforms, ...selectedVideoPlatforms]
  const hasImages = images.length > 0
  const hasVideos = videos.length > 0

  const upload = async () => {
    if (allSelected.length === 0) { setError('請至少選一個平台'); return }
    if (!copyText.trim()) { setError('請輸入發文文案'); return }
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
          { label: `圖片 ${images.length} 張`, ok: hasImages },
          { label: `影片 ${videos.length} 支`, ok: hasVideos },
          { label: '文案', ok: Object.keys(copyResults).length > 0 },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            s.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}>
            {s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {s.label} {s.ok ? '已備妥' : '尚未生成'}
          </div>
        ))}
        <a href="/settings" target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
          <Settings className="h-3.5 w-3.5" /> 平台連結設定
        </a>
      </div>

      {/* Image platform selector */}
      <div>
        <label className="block text-sm font-semibold mb-2">圖片發布平台</label>
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
        <label className="block text-sm font-semibold mb-2">影片發布平台</label>
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
          <label className="block text-sm font-semibold">選擇上傳圖片</label>
          {hasImages ? (
            <div className="flex gap-2 flex-wrap">
              {images.map(img => (
                <button key={img.url} onClick={() => setSelectedImageUrl(img.url)}
                  className="relative rounded-xl overflow-hidden border-2 transition-all"
                  style={selectedImageUrl === img.url ? { borderColor: 'var(--primary)' } : { borderColor: 'transparent' }}>
                  <img src={img.url} alt="圖片" className="w-16 h-16 object-cover" />
                  {selectedImageUrl === img.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">尚未在單元6生成圖片。</p>
          )}
        </div>
      )}

      {/* Video picker */}
      {selectedVideoPlatforms.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">選擇上傳影片</label>
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
            <p className="text-xs text-gray-400">尚未在單元8生成影片。</p>
          )}
        </div>
      )}

      {/* Copy text */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          發文文案
          {Object.keys(copyResults).length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">快速載入：</span>
          )}
          {Object.entries(copyResults).slice(0, 4).map(([k, v]) => {
            const labels: Record<string, string> = {
              facebook_post: 'FB', instagram_caption: 'IG', threads_post: 'Threads',
              line_message: 'LINE', twitter_post: 'Twitter', linkedin_post: 'LinkedIn',
              anchor_script: '🎙️主播',
            }
            return (
              <button key={k} onClick={() => setCopyText(v as string)}
                className="ml-1 text-xs px-2 py-0.5 rounded-full border hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {labels[k] ?? k}
              </button>
            )
          })}
        </label>
        <textarea value={copyText} onChange={e => setCopyText(e.target.value)} rows={6}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="輸入或從單元4載入文案…" />
        <div className="text-[10px] text-gray-400 mt-1">{copyText.length} 字</div>
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
          ? <><Loader2 className="h-4 w-4 animate-spin" />上傳中…</>
          : <><Upload className="h-4 w-4" />一鍵發布至 {allSelected.length} 個平台</>}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-700">上傳結果</div>
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.platform}
                className={`flex items-start gap-3 p-3 rounded-xl border ${r.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {r.ok
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {r.platform} — {r.ok ? '發布成功' : '發布失敗'}
                  </div>
                  {r.postId && <div className="text-xs text-green-600 mt-0.5">Post ID: {r.postId}</div>}
                  {r.error && (
                    <div className="text-xs text-red-600 mt-0.5">
                      {r.error}
                      {/expired|invalid.*token|token.*invalid|session.*expired/i.test(r.error) && (
                        <a href="/settings" className="ml-2 underline font-semibold text-red-700 hover:text-red-900">
                          → 前往設定更新 Token
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-400">
            {results.filter(r => r.ok).length}/{results.length} 個平台成功 · {savedData?.lastUpload?.uploadedAt ? new Date(savedData.lastUpload.uploadedAt).toLocaleString('zh-TW') : ''}
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
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — 多語言，女' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — 多語言，男' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — 多語言，女' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — 英式英語，男' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily — 多語言，女' },
  { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica — 美式英語，女' },
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
  const [fromName, setFromName] = useState(savedData?.fromName ?? '行銷團隊')
  const [fromEmail, setFromEmail] = useState(savedData?.fromEmail ?? '')
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(
    savedData?.emailTemplates ?? [
      { id: 'etpl-1', name: '預設腳本', subject: '', body: '' },
    ]
  )
  const [emailRules, setEmailRules] = useState<EmailRule[]>(
    savedData?.emailRules ?? [
      { id: 'erule-1', name: '一般客戶', desc: '一般潛在客戶或不明身份', templateId: 'etpl-1' },
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
    id: `etpl-${Date.now()}`, name: `腳本 ${prev.length + 1}`, subject: '', body: '',
  }])
  const updateEmailTemplate = (id: string, patch: Partial<EmailTemplate>) =>
    setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  const removeEmailTemplate = (id: string) =>
    setEmailTemplates(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev)

  // ── Email rule CRUD ──────────────────────────────────────────────────────────
  const addEmailRule = () => setEmailRules(prev => [...prev, {
    id: `erule-${Date.now()}`,
    name: `分類 ${prev.length + 1}`,
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
      return { email, group: emailRules[0]?.name ?? '一般' }
    }).filter(Boolean) as { email: string; group: string }[]
  }

  const handleEmailInput = (val: string) => {
    setEmailInput(val)
    setEmailRecipients(parseEmails(val))
  }

  const classifyEmails = async () => {
    if (emailRecipients.length === 0) return
    if (emailRules.length === 0) { setSendError('請先定義至少一條發送規則'); return }
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
    if (emailRecipients.length === 0) { setSendError('請輸入收件人清單'); return }
    const hasTemplate = emailTemplates.some(t => t.subject && t.body)
    if (!hasTemplate) { setSendError('請為至少一個腳本填寫主旨與內文'); return }
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
      if (!res.ok) throw new Error(data.error ?? '寄送失敗')
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
    if (!script.trim()) { setPreviewError('請先輸入或生成腳本'); return }
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
    if (!script.trim()) { setCallError('請先輸入腳本'); return }
    if (phones.length === 0) { setCallError('請輸入至少一個電話號碼'); return }
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
        {([['phone', '📞 電話行銷'], ['email', '📧 Email 行銷']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
            ✉️ 寄送服務：Resend
          </div>

          {/* From settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">寄件人名稱</label>
              <input value={fromName} onChange={e => setFromName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
                placeholder="行銷團隊" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">寄件人 Email（需在 Resend 驗證）</label>
              <input value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
                placeholder="marketing@yourdomain.com" />
            </div>
          </div>

          {/* ── Step 1: Email 模板 ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Step 1 — Email 模板（腳本）</div>
                <div className="text-[10px] text-gray-400 mt-0.5">定義不同的 Email 內容模板，稍後在發送規則中選用</div>
              </div>
              {(unit4Data?.results?.email_subject || unit4Data?.results?.email_body) && (
                <button
                  onClick={() => setEmailTemplates(prev => prev.map(t => ({
                    ...t,
                    subject: unit4Data.results!.email_subject ?? t.subject,
                    body: unit4Data.results!.email_body ?? t.body,
                  })))}
                  className="text-xs px-3 py-1.5 rounded-lg border text-indigo-600 border-indigo-300 hover:bg-indigo-50 flex-shrink-0"
                >
                  ⚡ 套用 Unit 4 至所有模板
                </button>
              )}
            </div>

            {emailTemplates.map((tpl, idx) => (
              <div key={tpl.id} className="border rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-5">{idx + 1}</span>
                  <input
                    value={tpl.name}
                    onChange={e => updateEmailTemplate(tpl.id, { name: e.target.value })}
                    placeholder="模板名稱（例如：博主版腳本）"
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
                      套用 Unit 4
                    </button>
                  )}
                  {emailTemplates.length > 1 && (
                    <button onClick={() => removeEmailTemplate(tpl.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Email 主旨</label>
                  <input
                    value={tpl.subject}
                    onChange={e => updateEmailTemplate(tpl.id, { subject: e.target.value })}
                    placeholder="Email 主旨…"
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Email 內文</label>
                  <textarea
                    value={tpl.body}
                    onChange={e => updateEmailTemplate(tpl.id, { body: e.target.value })}
                    rows={4}
                    placeholder="Email 內文…"
                    className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 resize-none bg-white"
                  />
                </div>
              </div>
            ))}
            <button onClick={addEmailTemplate}
              className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 justify-center">
              <Plus className="h-3.5 w-3.5" />新增模板
            </button>
          </div>

          {/* ── Step 2: 發送規則 ── */}
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Step 2 — 發送規則</div>
              <div className="text-[10px] text-gray-400 mt-0.5">定義分類名稱與 AI 判斷依據，並指定套用哪個模板。AI 依序比對，第一個符合的規則生效。</div>
            </div>

            {emailRules.map((rule, idx) => (
              <div key={rule.id} className="border rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-5">{idx + 1}</span>
                  <input
                    value={rule.name}
                    onChange={e => updateEmailRule(rule.id, { name: e.target.value })}
                    placeholder="分類名稱（例如：美妝博主）"
                    className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-semibold"
                  />
                  {emailRules.length > 1 && (
                    <button onClick={() => removeEmailRule(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">AI 分類依據（描述這類收件人特徵）</label>
                  <input
                    value={rule.desc}
                    onChange={e => updateEmailRule(rule.id, { desc: e.target.value })}
                    placeholder="例如：個人美妝博主，以社交媒體影響力為主的個人"
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">套用模板</label>
                  <select
                    value={rule.templateId}
                    onChange={e => updateEmailRule(rule.id, { templateId: e.target.value })}
                    className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                  >
                    {emailTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name || `模板 ${emailTemplates.indexOf(t) + 1}`}</option>
                    ))}
                  </select>
                </div>
                {emailRecipients.length > 0 && (
                  <div className="text-[10px] text-gray-400">
                    已分類至此：{emailRecipients.filter(r => r.group === rule.name).length} 個收件人
                  </div>
                )}
              </div>
            ))}
            <button onClick={addEmailRule}
              className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 justify-center">
              <Plus className="h-3.5 w-3.5" />新增規則
            </button>
          </div>

          {/* ── Step 3: 收件人清單 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Step 3 — 輸入收件人 Email</div>
                <div className="text-[10px] text-gray-400 mt-0.5">每行一個 Email，AI 依上方規則自動歸類</div>
              </div>
              <button onClick={classifyEmails} disabled={classifying || emailRecipients.length === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {classifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {classifying ? 'AI 分類中…' : 'AI 自動分類'}
              </button>
            </div>
            <textarea value={emailInput} onChange={e => handleEmailInput(e.target.value)} rows={5}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none font-mono"
              placeholder={'user@example.com\nvip@company.com\nlead@factory.com'} />
            <p className="text-[10px] text-gray-400">已識別 {emailRecipients.length} 個有效 Email</p>
          </div>

          {/* Parsed preview */}
          {emailRecipients.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-xl p-2">
              {emailRecipients.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs">
                  <span className="font-mono flex-1 text-gray-700">{r.email}</span>
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
              ? <><Loader2 className="h-4 w-4 animate-spin" />寄送中…（{emailRecipients.length} 封）</>
              : <>✉️ 開始寄送 {emailRecipients.length} 封 Email</>}
          </button>

          {/* Email results */}
          {emailResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">寄送結果</span>
                <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  {emailResults.filter(r => r.ok).length}/{emailResults.length} 成功
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
                      ? <span className="text-green-700">已寄出</span>
                      : <span className="text-red-600 truncate max-w-[180px]">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Env notice */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <div className="font-semibold mb-1">需在 Vercel 設定環境變數：</div>
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border text-xs font-medium text-gray-600">
          <Volume2 className="h-3.5 w-3.5" /> TTS：ElevenLabs
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border text-xs font-medium text-gray-600">
          <PhoneCall className="h-3.5 w-3.5" /> 撥打：Bird (app.bird.com)
        </div>
        {/* VBEE locked */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border text-xs text-gray-300 line-through cursor-not-allowed select-none">
          🇻🇳 VBEE — 待日後啟用
        </div>
      </div>

      {/* ElevenLabs + Bird settings */}
      <div className="p-4 rounded-xl bg-gray-50 border space-y-4">
        <div className="text-xs font-semibold text-gray-600">語音 / 撥號設定</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ElevenLabs 語音</label>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
              {ELEVEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Bird 顯示號碼 *</label>
            <input value={birdCallerId} onChange={e => setBirdCallerId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
              placeholder="+886xxxxxxxxx 或 +84xxxxxxxxx" />
          </div>
        </div>
      </div>

      {/* Script */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <label className="text-sm font-semibold">電話行銷腳本</label>
          <select value={scriptLang} onChange={e => setScriptLang(e.target.value)}
            className="h-7 px-2 rounded-lg border text-xs outline-none focus:ring-1 bg-white">
            {['繁體中文', '越南語', 'English', '簡體中文', '日本語'].map(l =>
              <option key={l}>{l}</option>)}
          </select>
          <button onClick={generateScript} disabled={generatingScript}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50 ml-auto"
            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
            {generatingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generatingScript ? 'AI 生成中…' : 'AI 自動生成'}
          </button>
        </div>
        <textarea value={script} onChange={e => setScript(e.target.value)} rows={8}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="您好！我是來自[公司]的[姓名]，今天打電話是想和您分享…" />
        <div className="text-[10px] text-gray-400 mt-1">{script.length} 字 · 建議 100-200 字（約 30-60 秒）</div>
      </div>

      {/* TTS Preview */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={preview} disabled={previewLoading || !script.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 hover:bg-gray-50 transition-colors">
          {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {previewLoading ? '生成語音中…' : '試聽語音'}
        </button>
        {previewUrl && <audio controls src={previewUrl} className="h-8 flex-1 min-w-0" />}
        {previewError && <span className="text-xs text-red-600">{previewError}</span>}
      </div>

      {/* Phone list */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          電話號碼清單
          <span className="ml-2 text-xs font-normal text-gray-400">已識別 {phones.length} 個</span>
        </label>
        <textarea value={phoneInput} onChange={e => handlePhoneInput(e.target.value)} rows={5}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 resize-none font-mono"
          placeholder={'+886912345678\n+84901234567\n+1234567890'} />
        <p className="text-[10px] text-gray-400 mt-1">每行一個號碼，或用逗號分隔，支援國際格式（需含國碼）</p>
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
          ? <><Loader2 className="h-4 w-4 animate-spin" />撥打中…（{phones.length} 通）</>
          : <><PhoneCall className="h-4 w-4" />開始撥打 {phones.length} 通電話</>}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">撥打結果</span>
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              {results.filter(r => r.ok).length}/{results.length} 成功
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${r.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {r.ok ? <PhoneCall className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <PhoneOff className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                <span className="font-mono font-medium">{r.phone}</span>
                {r.ok
                  ? <span className="text-green-700 ml-auto">撥出成功{r.id ? ` · ${r.id}` : ''}</span>
                  : <span className="text-red-600 ml-auto truncate max-w-[200px]">{r.error}</span>}
              </div>
            ))}
          </div>
          {savedData?.lastBatch && (
            <div className="text-[10px] text-gray-400">
              {new Date(savedData.lastBatch.calledAt).toLocaleString('zh-TW')} · ElevenLabs + Bird
            </div>
          )}
        </div>
      )}

      {/* Env notice */}
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
        <div className="font-semibold mb-1">需在 Vercel 設定環境變數：</div>
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
  { value: '16:9', label: '橫式 16:9', desc: 'YouTube / 廣告' },
  { value: '9:16', label: '直式 9:16', desc: 'Reels / TikTok' },
  { value: '1:1',  label: '方形 1:1',  desc: 'Instagram' },
]

const BG_PRESETS = [
  { value: '#FFFFFF', label: '白色' },
  { value: '#000000', label: '黑色' },
  { value: '#F0F4FF', label: '淡藍' },
  { value: '#FFF8F0', label: '淡橙' },
  { value: '#F0FFF4', label: '淡綠' },
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
    if (!selectedAvatar) { setSubmitError('請選擇主播 Avatar'); return }
    if (!selectedVoice)  { setSubmitError('請選擇聲音'); return }
    if (!anchorScript)   { setSubmitError('請先在 Unit 4 文案產出中勾選「🎙️ 主播口播腳本」並生成'); return }
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
      if (!res.ok) { setSubmitError(data.error ?? '提交失敗'); return }

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
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Mic className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            主播行銷
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">使用 HeyGen 虛擬主播生成行銷影片</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
          <span className="font-medium text-indigo-600">HeyGen</span>
          <span>AI Avatar 影片</span>
          <span className="text-gray-300">·</span>
          <span>自動存入 Supabase</span>
        </div>
      </div>

      {/* Step 1: Loading state */}
      {!assetsLoaded ? (
        <div className="border rounded-xl p-5 space-y-3 bg-indigo-50 border-indigo-200">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-indigo-600" />
            <span className="font-medium text-indigo-800 text-sm">載入 HeyGen 主播資源</span>
          </div>
          {loadingAssets
            ? <div className="flex items-center gap-2 text-sm text-indigo-600"><Loader2 className="h-4 w-4 animate-spin" />載入中…</div>
            : <button onClick={loadAssets}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--primary)' }}>
                重新載入主播 &amp; 聲音清單
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
                <span className="font-medium text-sm text-gray-700">選擇主播 Avatar</span>
                <span className="text-xs text-gray-400">{avatars.length} 個可用</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {avatars.map(av => (
                  <button key={av.id} onClick={() => setSelectedAvatar(av)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      selectedAvatar?.id === av.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    {av.preview
                      ? <img src={av.preview} alt={av.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Mic className="h-4 w-4 text-gray-400" />
                        </div>
                    }
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{av.name}</div>
                      <div className="text-[10px] text-gray-400 capitalize">{av.gender}</div>
                    </div>
                    {selectedAvatar?.id === av.id && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice selector */}
            <div className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-700">選擇聲音</span>
                <span className="text-xs text-gray-400">{voices.length} 個可用</span>
              </div>
              <select value={selectedVoice?.id ?? ''}
                onChange={e => setSelectedVoice(voices.find(v => v.id === e.target.value) ?? null)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">— 選擇聲音 —</option>
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
              <span className="font-medium text-sm text-gray-700">影片格式 &amp; 背景</span>
              <div className="flex gap-2">
                {AVATAR_RATIOS.map(r => (
                  <button key={r.value} onClick={() => setRatio(r.value)}
                    className={`flex-1 text-center py-2 px-2 rounded-lg border text-xs transition-all ${
                      ratio === r.value ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-gray-400">{r.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">背景色：</span>
                {BG_PRESETS.map(b => (
                  <button key={b.value} onClick={() => { setBackground(b.value); setCustomBg('') }}
                    title={b.label}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${background === b.value && !customBg ? 'border-indigo-400 scale-110' : 'border-gray-200'}`}
                    style={{ background: b.value }} />
                ))}
                <input type="color" value={customBg || background}
                  onChange={e => setCustomBg(e.target.value)}
                  className="w-6 h-6 rounded-full border border-gray-300 cursor-pointer"
                  title="自訂顏色" />
                <div className="w-5 h-5 rounded border" style={{ background: bgFinal }} />
                <span className="text-[10px] text-gray-400">{bgFinal}</span>
              </div>
            </div>
          </div>

          {/* Right: Script preview from Unit 4 */}
          <div className="space-y-4">
            <div className="border-2 rounded-xl p-4 space-y-3 border-indigo-200 bg-indigo-50">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-indigo-600" />
                <span className="font-semibold text-sm text-indigo-800">主播口播腳本</span>
                {unit4Data?.anchorDuration && (
                  <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                    {unit4Data.anchorDuration}秒 · {unit4Data.anchorStyle ?? ''}
                  </span>
                )}
              </div>
              {unit4Data?.results?.anchor_script ? (
                <>
                  <div className="text-[10px] text-indigo-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    來自 Unit 4 文案產出（{unit4Data.results.anchor_script.length} 字）
                    · 如需修改請返回 Unit 4 重新生成
                  </div>
                  <div className="bg-white border border-indigo-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {unit4Data.results.anchor_script}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className="text-sm text-indigo-700 font-medium">尚無主播腳本</div>
                  <div className="text-xs text-indigo-500">
                    請前往 <span className="font-semibold">Unit 4 文案產出</span> → 勾選「🎙️ 主播口播腳本」→ 設定秒數 → 產生文案
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
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交生成中…</> : <><Film className="h-4 w-4" />生成主播影片</>}
            </button>
          </div>
        </div>
      )}

      {/* Video list */}
      {videos.length > 0 && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-700">主播影片記錄</span>
            <span className="text-xs text-gray-400">{videos.length} 部</span>
          </div>
          <div className="space-y-3">
            {videos.map(v => (
              <div key={v.videoId} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        v.status === 'completed' ? 'bg-green-100 text-green-700' :
                        v.status === 'failed'    ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {v.status === 'completed' ? '✓ 完成' : v.status === 'failed' ? '✗ 失敗' : '⏳ 生成中'}
                      </span>
                      <span className="text-[10px] text-gray-500">{v.avatarName}</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500">{v.voiceName}</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500">{v.ratio}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{v.script}</p>
                    <p className="text-[10px] text-gray-400">{new Date(v.createdAt).toLocaleString('zh-TW')}</p>
                  </div>
                  {v.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0 mt-0.5" />}
                </div>
                {v.status === 'completed' && v.videoUrl && (
                  <div className="space-y-1.5">
                    <video src={v.videoUrl} controls className="w-full max-h-48 rounded-lg bg-black" />
                    <a href={v.videoUrl} download target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                      <Download className="h-3.5 w-3.5" />下載影片
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Env var hint */}
      <div className="bg-gray-50 border rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <div className="font-medium text-gray-600">需要設定的環境變數：</div>
        <div className="flex gap-2 flex-wrap">
          <code className="bg-indigo-100 px-1.5 py-0.5 rounded">HEYGEN_API_KEY</code>
        </div>
      </div>
    </div>
  )
}

// ─── Unit 12: 客服系統 ────────────────────────────────────────────────────────

interface CsLogEntry {
  message: string
  reply: string
  intent: string
  risk: 'low' | 'medium' | 'high'
  provider: 'Gemini' | 'Claude'
  latencyMs: number
  ts: string
}

interface CsDialogueFile {
  url: string
  name: string
  sizeKb: number
  textContent: string
}

type BookingStep =
  | 'product'       // 行程/產品/房型 選擇
  | 'date_depart'   // 出發日期
  | 'date_checkin'  // 入住日期
  | 'date_checkout' // 退房日期
  | 'timeslot'      // 出發/入住 時段/班次
  | 'headcount'     // 人數（大人/小孩/嬰兒）
  | 'passenger_id'  // 乘客資料（姓名+生日+身分證，逐人，團保用）
  | 'booker_name'   // 訂房/訂位人姓名
  | 'quote'         // 報價（AI 自動套定價計算機計算並告知）
  | 'email'         // 電子郵件
  | 'plate'         // 車牌號碼
  | 'phone'         // 聯絡電話
  | 'special_req'   // 特殊需求

const BOOKING_STEP_LABELS: Record<BookingStep, string> = {
  product:       '行程/產品/房型 選擇',
  date_depart:   '出發日期',
  date_checkin:  '入住日期',
  date_checkout: '退房日期',
  timeslot:      '時段/班次',
  headcount:     '人數（大人/小孩/嬰兒）',
  passenger_id:  '乘客資料（姓名+生日+身分證，逐人收集）',
  booker_name:   '訂房/訂位人姓名',
  quote:         '報價（AI 套定價計算機計算總價並告知客人）',
  email:         '電子郵件',
  plate:         '車牌號碼',
  phone:         '聯絡電話',
  special_req:   '特殊需求',
}

interface BookingFlowDef {
  id: string
  name: string
  triggerKeywords: string   // 逗號分隔
  dataHint: string          // 對應知識庫/定價模組的關鍵字，例如「賞鯨」「海景大床房」
  steps: BookingStep[]
  paymentInfo: string
}

const DEFAULT_FLOWS: BookingFlowDef[] = [
  {
    id: 'tour',
    name: '行程預訂（賞鯨/出海）',
    triggerKeywords: '賞鯨,繞島,登島,出海,行程',
    dataHint: '賞鯨',
    steps: ['product', 'date_depart', 'timeslot', 'headcount', 'passenger_id', 'phone'],
    paymentInfo: '',
  },
]

interface CsTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  platform: string
  from_name?: string
  intent?: string
  created_at: string
  updated_at: string
}

interface CsInboxMessage {
  id: string
  platform: string
  from_id: string
  from_name?: string
  message: string
  reply?: string
  intent?: string
  risk?: string
  latency_ms?: number
  created_at: string
}

interface Unit12Data {
  systemPrompt?: string
  knowledgeBase?: string
  escalationThreshold?: 'medium' | 'high'
  replyLanguage?: string
  logs?: CsLogEntry[]
  dialogueFiles?: CsDialogueFile[]
  bookingFlowEnabled?: boolean
  paymentInfo?: string
  bookingFlows?: BookingFlowDef[]
  vipList?: string        // 換行分隔的 VIP 名單
  autoCloseMinutes?: number
}

const CS_PLATFORMS = [
  {
    id: 'line',
    name: 'LINE OA',
    color: '#00B900',
    envVars: ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'],
    note: 'LINE Developers Console → Messaging API → 填入下方 Webhook URL',
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    showWebhook: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    color: '#25D366',
    envVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
    note: 'Meta Developer → WhatsApp → Configuration → 填入下方 Webhook URL',
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    showWebhook: true,
  },
  {
    id: 'whatsapp_personal',
    name: 'WhatsApp 個人版',
    color: '#128C7E',
    envVars: ['WHATSAPP_PERSONAL_BRIDGE_URL', 'WHATSAPP_PERSONAL_API_KEY'],
    note: '需自行架設 Baileys Bridge Server（Node.js），掃 QR 碼後即可接收個人帳號訊息',
    docUrl: 'https://github.com/WhiskeySockets/Baileys',
    showWebhook: false,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#2AABEE',
    envVars: ['TELEGRAM_BOT_TOKEN'],
    note: '向 @BotFather 建立 Bot，取得 Bot Token 填入。設定管理員 Chat ID 後，客戶訊息將同步轉發給管理員，管理員可直接在 Bot 對話中回覆客戶。',
    docUrl: 'https://core.telegram.org/bots/tutorial',
    showWebhook: false,
  },
  {
    id: 'zalo',
    name: 'Zalo OA',
    color: '#0068FF',
    envVars: ['ZALO_OA_ACCESS_TOKEN'],
    note: 'Zalo for Business → Official Account → Webhook → 填入下方 Webhook URL',
    docUrl: 'https://developers.zalo.me/docs/official-account',
    showWebhook: true,
  },
  {
    id: 'wechat',
    name: 'WeChat',
    color: '#07C160',
    envVars: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
    note: 'WeChat Official Account → 開發設定 → 伺服器配置 → 填入下方 Webhook URL',
    docUrl: 'https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html',
    showWebhook: true,
  },
]

type Cs12Tab = 'platforms' | 'ai-settings' | 'dialogue-files' | 'data-sources' | 'pricing' | 'test' | 'logs' | 'tickets' | 'inbox'

interface CsDataSource {
  id: string
  name: string
  enabled: boolean
  config: {
    apiKey: string
    spreadsheetId: string
    sheetName: string
    keyColumn: string
    returnColumns: string[]
    triggerKeywords: string[]
    triggerMode?: 'keyword' | 'numeric' | 'both'
  }
}

// ─── Industry Templates ───────────────────────────────────────────
interface IndustryTemplate {
  label: string
  emoji: string
  systemPrompt: string
  knowledgeBase: string
  bookingFlowEnabled: boolean
  bookingFlows: BookingFlowDef[]
  recommendedSheets: Array<{
    name: string
    description: string
    keyColumn: string
    returnColumnsExample: string
    triggerKeywords: string
    triggerMode: 'keyword' | 'numeric' | 'both'
  }>
  pricingButtons: Array<{ key: string; label: string }>
}

const CS_INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  homestay: {
    label: '民宿 / 旅遊',
    emoji: '🏡',
    systemPrompt: '你是【民宿名稱】的親切專業客服助理。請用溫暖友善的語氣回應客人問題，協助房型查詢、預訂流程、退訂政策說明與周邊行程安排建議。\n\n【核心任務】\n1. 房型查詢：介紹各房型特色、容納人數、價格（平假日）\n2. 訂房引導：依序收集入住/退房日期、人數、姓名、電話\n3. 退訂政策：入住 48 小時前可免費取消，逾時收一晚費用\n4. 行程推薦：根據客人需求推薦周邊景點與活動\n\n若客人詢問無法確定的問題，請主動說「我幫您轉接人工客服確認」。',
    knowledgeBase: '【房型資訊】\n- 海景雙人房：2人，平日 2,800，假日 3,500\n- 山景家庭房：4人，平日 4,200，假日 5,500，含早餐\n- 豪華套房：2人，平日 4,800，假日 6,000\n\n【入住須知】\nCheck-in：15:00 後　Check-out：11:00 前\n停車：免費，限一台\n寵物：不可攜帶\n\n【退訂政策】\n- 入住 48 小時前取消：全額退款\n- 48 小時內取消：收取一晚費用\n- 當日取消：不退款\n\n【周邊景點】\n車程 10 分鐘：老街、夜市\n車程 20 分鐘：國家公園、瀑布步道',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'room', name: '訂房', triggerKeywords: '預訂,訂房,入住,房型,空房,有沒有房', dataHint: '房型定價', steps: ['product', 'date_checkin', 'date_checkout', 'headcount', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
      { id: 'tour', name: '行程諮詢', triggerKeywords: '行程,景點,推薦,附近,玩什麼', dataHint: '行程', steps: ['date_checkin', 'headcount', 'phone'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂單密碼表', description: '客人輸入訂單號自動回覆房號、密碼（不含定價）', keyColumn: '訂單編號', returnColumnsExample: '房號,大門密碼,房間密碼,入住日,退房日', triggerKeywords: '訂單,密碼,房號', triggerMode: 'numeric' },
    ],
    pricingButtons: [{ key: 'accommodation', label: '+ 訂房定價' }, { key: 'tour', label: '+ 行程定價' }, { key: 'custom', label: '+ 自訂' }],
  },
  ecommerce: {
    label: '電商 / 零售',
    emoji: '🛍️',
    systemPrompt: '你是【品牌名稱】的專業電商客服助理。請協助客人查詢訂單狀態、處理退換貨申請、追蹤物流進度，以及解答商品問題與促銷資訊。\n\n【核心任務】\n1. 訂單查詢：請客人提供訂單號，自動查詢狀態\n2. 退換貨：說明退換貨流程（7天鑑賞期），收集客人資料\n3. 商品問題：說明商品規格、材質、尺寸\n4. 物流追蹤：提供預計到貨時間與物流單號\n\n若客人情緒激動，請先表達理解與歉意，再轉接人工處理。',
    knowledgeBase: '【退換貨政策】\n收到商品 7 天內可申請退換貨（商品須未使用、含原包裝）\n退款時間：審核通過後 5-7 個工作天\n\n【物流說明】\n台灣本島：下單後 1-3 個工作天出貨\n離島地區：額外 1-2 個工作天\n\n【促銷活動】\n滿 $1,000 免運費\n首購優惠碼：WELCOME88（折扣 88 元）\n\n【商品保固】\n電子商品：1年保固\n服飾：無品質瑕疵不退（非人為損壞）',
    bookingFlowEnabled: false,
    bookingFlows: [
      { id: 'return', name: '退換貨申請', triggerKeywords: '退貨,換貨,退款,瑕疵,壞掉,不喜歡', dataHint: '退換貨', steps: ['product', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂單查詢表', description: '客人輸入訂單號自動回覆物流狀態（不含定價）', keyColumn: '訂單編號', returnColumnsExample: '訂單編號,商品名稱,數量,物流單號,配送狀態,預計到貨日', triggerKeywords: '訂單,查詢,到貨,物流,進度', triggerMode: 'numeric' },
      { name: '商品規格目錄', description: '客人詢問商品材質/尺寸/規格，不含價格（價格用定價計算機）', keyColumn: '商品名稱', returnColumnsExample: '商品名稱,規格,材質說明,尺寸對照,庫存狀態,注意事項', triggerKeywords: '規格,尺寸,材質,怎麼選', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 商品定價' }, { key: 'custom', label: '+ 運費方案' }],
  },
  restaurant: {
    label: '餐廳 / 餐飲',
    emoji: '🍽️',
    systemPrompt: '你是【餐廳名稱】的熱情客服助理。請協助客人線上訂位、查詢菜單與價格、了解外送時間與範圍，以及安排包廂服務。\n\n【核心任務】\n1. 訂位：確認日期、時段、人數，收集姓名電話\n2. 菜單查詢：介紹招牌菜、套餐內容與價格\n3. 外送服務：說明外送範圍、最低消費、預計時間\n4. 包廂預訂：說明包廂規格、最低消費、預約流程\n\n請用熱情親切的語氣，讓每位客人感受到賓至如歸。',
    knowledgeBase: '【訂位說明】\n用餐時段：11:30-14:00（午餐）、17:30-21:00（晚餐）\n包廂：可容納 8-20 人，需預訂，最低消費 $3,000\n訂位需提前 1 天，當日訂位請來電確認\n\n【套餐資訊】\n商業午餐套餐（平日限定）：$350/人，含主菜+湯+飲料\n家庭套餐：$1,200/4人，含 6 道菜\n\n【外送說明】\n外送範圍：3 公里內\n最低消費：$500\n外送費：$60（滿 $800 免外送費）\n預計時間：30-45 分鐘\n\n【過敏原說明】\n含麩質、蛋、奶製品，請有過敏需求提前告知',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'reservation', name: '訂位', triggerKeywords: '訂位,用餐,訂桌,包廂,座位,預約', dataHint: '訂位', steps: ['date_depart', 'timeslot', 'headcount', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
      { id: 'delivery', name: '外送點餐', triggerKeywords: '外送,外帶,訂餐,送餐,點餐', dataHint: '外送', steps: ['booker_name', 'phone', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂位可用時段', description: '客人詢問今日/特定日期是否有位可訂', keyColumn: '日期', returnColumnsExample: '日期,午餐可訂時段,晚餐可訂時段,包廂是否可用,備註', triggerKeywords: '訂位,有沒有位,時段,包廂,今天', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 套餐定價' }, { key: 'custom', label: '+ 包廂費用' }, { key: 'custom', label: '+ 自訂' }],
  },
  clinic: {
    label: '診所 / 醫美',
    emoji: '🏥',
    systemPrompt: '你是【診所名稱】的專業客服助理。請協助患者預約掛號、了解療程項目與費用、查詢術後照護，以及回答診所相關問題。\n\n【核心任務】\n1. 療程查詢：介紹各療程項目、效果說明、適合對象\n2. 費用查詢：說明自費項目費用（健保項目請現場確認）\n3. 預約引導：收集療程、醫師偏好、日期時段、姓名電話\n4. 術後照護：說明術後注意事項與回診時間\n\n⚠️ 涉及具體醫療診斷或治療建議，請務必引導「建議到診所與醫師當面諮詢」。',
    knowledgeBase: '【主要療程】\n- 玻尿酸注射：$6,000 起/次，效果 6-12 個月\n- 肉毒桿菌：$3,000 起（依部位），效果 4-6 個月\n- 淨膚雷射：$2,500/次，建議每月 1 次\n- 醫美諮詢：免費，需事先預約\n\n【掛號須知】\n看診時段：週一~週五 10:00-19:00，週六 10:00-17:00\n初診請提前 15 分鐘到院填寫資料\n\n【術後照護】\n注射後 24 小時勿揉壓部位\n注射後 1 週回診確認效果\n有任何不適請立即聯繫診所\n\n【費用說明】\n醫美療程為自費項目，無法使用健保',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'appointment', name: '預約掛號', triggerKeywords: '預約,掛號,看診,療程,諮詢,想做', dataHint: '療程', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '醫師/諮詢師排班', description: '客人詢問特定醫師何時有空可預約（不含費用）', keyColumn: '醫師姓名', returnColumnsExample: '醫師姓名,專長,週一,週二,週三,週四,週五,週六', triggerKeywords: '醫師,排班,什麼時候有,誰', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 療程費用' }, { key: 'custom', label: '+ 套療方案' }],
  },
  beauty: {
    label: '美容 / 美髮 / SPA',
    emoji: '💆',
    systemPrompt: '你是【店家名稱】的貼心客服助理。請協助客人預約服務、查詢價目表、了解設計師專長，以及提供護理保養建議。\n\n【核心任務】\n1. 服務查詢：介紹各項服務項目與價格（依髮長計費）\n2. 設計師推薦：根據客人需求推薦合適設計師\n3. 預約引導：收集服務項目、設計師、日期時段、姓名電話\n4. 護理建議：提供燙染後護理、日常保養建議\n\n請用溫柔親切的語氣，讓每位客人都感到被重視。',
    knowledgeBase: '【服務價目】\n剪髮：短髮 $300，中長髮 $350，長髮 $400\n染髮：短髮 $1,800 起，長髮 $2,500 起（依色系調整）\n燙髮：短髮 $2,000 起，長髮 $3,000 起\n護髮：$800-1,500（依長度）\n\n【設計師介紹】\n小美設計師：擅長自然染、修護燙，客人評價★★★★★\n阿傑設計師：擅長造型剪、韓系風格，客人評價★★★★\n\n【預約說明】\n建議提前 3 天預約\n如需更改請提前 1 天告知\n\n【注意事項】\n燙染後 3 天勿洗頭\n懷孕或過敏體質請事先告知設計師',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'booking', name: '服務預約', triggerKeywords: '預約,剪髮,染髮,護髮,燙髮,美甲,SPA,按摩', dataHint: '服務', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '設計師排班表', description: '客人指定設計師時查詢可預約時段（不含服務定價）', keyColumn: '設計師姓名', returnColumnsExample: '設計師,專長,週一,週二,週三,週四,週五,週六,週日', triggerKeywords: '設計師,排班,什麼時候有,誰', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 服務定價' }, { key: 'custom', label: '+ 組合優惠' }],
  },
  education: {
    label: '教育 / 補習班',
    emoji: '📚',
    systemPrompt: '你是【機構名稱】的專業客服助理。請協助家長與學生了解課程內容、預約試聽、查詢學費方案，以及介紹師資陣容。\n\n【核心任務】\n1. 課程查詢：介紹各年級/程度課程內容與特色\n2. 學費說明：提供月繳/季繳/年繳方案，計算優惠\n3. 試聽預約：收集課程、學生年級、日期時段、家長聯絡資料\n4. 師資介紹：根據學生需求推薦合適老師\n\n請用正向積極的語氣，讓家長與學生對學習充滿信心。',
    knowledgeBase: '【課程項目】\n數學班：國小/國中/高中，各年級分班教學\n英文班：基礎/進階/會話/作文，週 2 堂\n理化班：國中/高中，小班制 8 人\n\n【學費方案】\n月繳：$3,600/月（週 2 堂）\n季繳：$10,000/季（省 $800）\n年繳：$36,000/年（省 $7,200，最優惠）\n\n【試聽說明】\n免費試聽 1 堂，需事先預約\n試聽後 3 天內報名享 9 折優惠\n\n【師資特色】\n師大/師院畢業，平均教學年資 5 年以上\n小班制（最多 10 人），確保學習品質',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'trial', name: '免費試聽預約', triggerKeywords: '試聽,體驗課,報名,想學,課程,補習', dataHint: '課程', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '試聽可用時段', description: '客人詢問試聽時段時查詢剩餘名額（不含學費）', keyColumn: '課程', returnColumnsExample: '課程,日期,時段,老師,剩餘名額', triggerKeywords: '試聽,什麼時候,有沒有,名額', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 學費方案' }, { key: 'custom', label: '+ 課程定價' }],
  },
}

function Unit12CustomerService({
  campaignId,
  savedData,
  unit2Data,
  industry,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit12Data
  unit2Data?: Unit2Data
  industry?: string
  onDone: (data: Unit12Data) => void
}) {
  const [tab, setTab] = useState<Cs12Tab>('platforms')

  // AI settings
  const [systemPrompt, setSystemPrompt] = useState(savedData?.systemPrompt ?? '')
  const [knowledgeBase, setKnowledgeBase] = useState(savedData?.knowledgeBase ?? '')
  const [escalationThreshold, setEscalationThreshold] = useState<'medium' | 'high'>(savedData?.escalationThreshold ?? 'high')
  const [replyLanguage, setReplyLanguage] = useState(savedData?.replyLanguage ?? 'auto')
  const [bookingFlowEnabled, setBookingFlowEnabled] = useState(savedData?.bookingFlowEnabled ?? false)
  const [paymentInfo, setPaymentInfo] = useState(savedData?.paymentInfo ?? '')
  const [bookingFlows, setBookingFlows] = useState<BookingFlowDef[]>(savedData?.bookingFlows ?? DEFAULT_FLOWS)
  const [editingFlow, setEditingFlow] = useState<BookingFlowDef | null>(null)
  // VIP 識別 + 自動結案
  const [vipList, setVipList] = useState(savedData?.vipList ?? '')
  const [autoCloseMinutes, setAutoCloseMinutes] = useState(savedData?.autoCloseMinutes ?? 0)

  // Dialogue files
  const [dialogueFiles, setDialogueFiles] = useState<CsDialogueFile[]>(savedData?.dialogueFiles ?? [])

  // Sync when savedData loads asynchronously from Supabase
  // Track last savedData ref to avoid overwriting local uploads with stale DB data
  const lastSavedDataRef = useRef<Unit12Data | undefined>(undefined)
  useEffect(() => {
    if (!savedData || savedData === lastSavedDataRef.current) return
    lastSavedDataRef.current = savedData
    if (savedData.systemPrompt !== undefined) setSystemPrompt(savedData.systemPrompt)
    if (savedData.knowledgeBase !== undefined) setKnowledgeBase(savedData.knowledgeBase)
    if (savedData.escalationThreshold) setEscalationThreshold(savedData.escalationThreshold)
    if (savedData.replyLanguage) setReplyLanguage(savedData.replyLanguage)
    if (savedData.bookingFlowEnabled !== undefined) setBookingFlowEnabled(savedData.bookingFlowEnabled)
    if (savedData.paymentInfo !== undefined) setPaymentInfo(savedData.paymentInfo)
    if (savedData.bookingFlows?.length) setBookingFlows(savedData.bookingFlows)
    if (savedData.vipList !== undefined) setVipList(savedData.vipList)
    if (savedData.autoCloseMinutes !== undefined) setAutoCloseMinutes(savedData.autoCloseMinutes)
    // Only restore files from DB if local state is empty (don't overwrite user's current session files)
    if (savedData.dialogueFiles?.length) setDialogueFiles(savedData.dialogueFiles)
  }, [savedData])

  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingDialogue, setUploadingDialogue] = useState(false)
  const dialogueInputRef = useRef<HTMLInputElement>(null)

  const handleDialogueUpload = async (file: File) => {
    setUploadingDialogue(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', 'faq')
    try {
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) {
        const newFiles = [...dialogueFiles, {
          url: data.url,
          name: file.name,
          sizeKb: data.sizeKb ?? Math.round(file.size / 1024),
          textContent: data.textContent ?? '',
        }]
        setDialogueFiles(newFiles)
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles, bookingFlowEnabled, paymentInfo, bookingFlows })
      }
    } finally {
      setUploadingDialogue(false)
    }
  }

  const removeDialogueFile = (url: string) => {
    const newFiles = dialogueFiles.filter(f => f.url !== url)
    setDialogueFiles(newFiles)
    onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles, bookingFlowEnabled, paymentInfo })
  }

  // Test chat
  const [testInput, setTestInput] = useState('')
  const [testHistory, setTestHistory] = useState<{ role: 'user' | 'assistant'; content: string; meta?: { intent?: string; risk?: string; provider?: string } }[]>([])
  const [testLoading, setTestLoading] = useState(false)

  // 對話摘要
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState('')

  // 智慧草稿
  const [draftMode, setDraftMode] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftMeta, setDraftMeta] = useState<{ intent?: string; risk?: string; provider?: string } | null>(null)
  const [draftUserMsg, setDraftUserMsg] = useState('')

  // 自動滿意度問卷 / 結案
  const [caseClosed, setCaseClosed] = useState(false)
  const [autoCloseSecondsLeft, setAutoCloseSecondsLeft] = useState<number | null>(null)
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 工單系統
  const [tickets, setTickets] = useState<CsTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketFilter, setTicketFilter] = useState<string>('all')

  // 統一收件匣
  const [inboxMessages, setInboxMessages] = useState<CsInboxMessage[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxPlatformFilter, setInboxPlatformFilter] = useState<string>('all')

  // Logs
  const [logs, setLogs] = useState<CsLogEntry[]>(savedData?.logs ?? [])

  // Data sources
  const [dataSources, setDataSources] = useState<CsDataSource[]>([])
  const [dsLoading, setDsLoading] = useState(false)
  const [editingDs, setEditingDs] = useState<CsDataSource | null>(null)
  const [editingDsForm, setEditingDsForm] = useState<CsDataSource['config'] & { name: string }>({
    name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword',
  })
  const [savingDs, setSavingDs] = useState(false)

  // Pricing configs
  const [pricingConfigs, setPricingConfigs] = useState<Array<{ id: string; name: string; enabled: boolean; config: Record<string, unknown> }>>([])
  const [editingPc, setEditingPc] = useState<{ id: string; name: string; jsonText: string } | null>(null)
  const [savingPc, setSavingPc] = useState(false)
  const [pcJsonError, setPcJsonError] = useState('')

  // Breakfast webhook config
  const [breakfastCfgId, setBreakfastCfgId] = useState<string | null>(null)
  const [breakfastForm, setBreakfastForm] = useState({
    webhookUrl: '',
    cutoffTime: '22:00',
    deliveryTime: '07:50',
    rooms: '',   // 每行一間，例：201 龜山加大床房
    menu: '',    // 每行一個選項，例：SET A 薯餅起司堡
  })
  const [savingBreakfast, setSavingBreakfast] = useState(false)

  const PRICING_TEMPLATES: Record<string, object> = {
    tour: {
      productType: 'tour',
      triggerKeywords: ['賞鯨', '行程', '出海'],
      currency: 'TWD',
      schedules: [
        { id: 'A', name: 'A班 08:00' },
        { id: 'B', name: 'B班 10:30' },
        { id: 'C', name: 'C班 13:00' },
        { id: 'D', name: 'D班 15:30' },
      ],
      segments: [
        { label: '成人（12歲以上）', key: 'adult', weekdayPrice: 800, weekendPrice: 1000 },
        { label: '兒童（3-11歲）', key: 'child', weekdayPrice: 500, weekendPrice: 600 },
        { label: '嬰兒（0-2歲）', key: 'infant', weekdayPrice: 0, weekendPrice: 0 },
      ],
      packages: [
        { name: '四人家庭套餐', price: 2600, description: '2大2小' },
      ],
      groupDiscounts: [
        { minPeople: 10, discountPercent: 10, note: '10人以上團體' },
      ],
      cancellationPolicy: '出發前 24 小時取消，否則收取全額費用',
      notes: ['颱風警報取消全額退款', '集合地點請洽客服確認'],
    },
    accommodation: {
      productType: 'accommodation',
      triggerKeywords: ['訂房', '住宿', '房間', '入住', '一晚'],
      currency: 'TWD',
      rooms: [
        {
          name: '401高地景觀房',
          capacity: 4,
          weekdayPrice: 2800,
          weekendPrice: 3500,
          holidayPrice: 4200,
          extraPersonFee: 500,
        },
      ],
      cancellationPolicy: '入住前 48 小時取消，否則收取一晚費用',
      notes: ['含早餐', '最晚入住時間 22:00', 'Check-out 11:00'],
    },
    custom: {
      productType: 'custom',
      triggerKeywords: ['產品名稱', '關鍵字'],
      currency: 'TWD',
      customContent: '請在此填入自訂定價說明\n例：單次體驗 $500，月票 $1,500',
      cancellationPolicy: '',
      notes: [],
    },
  }

  const ind = industry ?? 'homestay'

  useEffect(() => {
    fetch(`/api/marketing/cs-datasource?industry=${ind}`).then(r => r.json()).then(d => {
      if (d.sources) {
        setDataSources(d.sources.filter((s: { type: string }) => s.type !== 'json_pricing' && s.type !== 'breakfast_webhook'))
        setPricingConfigs(d.sources.filter((s: { type: string }) => s.type === 'json_pricing'))
        const bk = d.sources.find((s: { type: string }) => s.type === 'breakfast_webhook')
        if (bk) {
          setBreakfastCfgId(bk.id)
          setBreakfastForm({
            webhookUrl:   bk.config.webhookUrl   ?? '',
            cutoffTime:   bk.config.cutoffTime   ?? '22:00',
            deliveryTime: bk.config.deliveryTime ?? '07:50',
            rooms: (bk.config.rooms ?? []).join('\n'),
            menu:  (bk.config.menu  ?? []).join('\n'),
          })
        }
      }
    }).catch(() => {})
  }, [ind])

  function openAddPc(templateKey?: string) {
    const template = templateKey ? PRICING_TEMPLATES[templateKey] : PRICING_TEMPLATES.tour
    setEditingPc({ id: '', name: '', jsonText: JSON.stringify(template, null, 2) })
    setPcJsonError('')
  }

  function openEditPc(pc: { id: string; name: string; config: Record<string, unknown> }) {
    setEditingPc({ id: pc.id, name: pc.name, jsonText: JSON.stringify(pc.config, null, 2) })
    setPcJsonError('')
  }

  async function savePc() {
    if (!editingPc) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editingPc.jsonText)
      setPcJsonError('')
    } catch (e) {
      setPcJsonError(`JSON 格式錯誤：${String(e)}`)
      return
    }
    setSavingPc(true)
    try {
      if (editingPc.id) {
        const r = await fetch(`/api/marketing/cs-datasource/${editingPc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: parsed, enabled: true }),
        })
        const d = await r.json()
        if (d.source) setPricingConfigs(prev => prev.map(p => p.id === editingPc.id ? d.source : p))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: parsed, type: 'json_pricing', industry: ind }),
        })
        const d = await r.json()
        if (d.source) setPricingConfigs(prev => [...prev, d.source])
      }
      setEditingPc(null)
    } catch {}
    setSavingPc(false)
  }

  async function deletePc(id: string) {
    await fetch(`/api/marketing/cs-datasource/${id}`, { method: 'DELETE' })
    setPricingConfigs(prev => prev.filter(p => p.id !== id))
  }

  async function togglePc(pc: { id: string; name: string; enabled: boolean; config: Record<string, unknown> }) {
    const r = await fetch(`/api/marketing/cs-datasource/${pc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pc.name, config: pc.config, enabled: !pc.enabled }),
    })
    const d = await r.json()
    if (d.source) setPricingConfigs(prev => prev.map(p => p.id === pc.id ? d.source : p))
  }

  function openAddDs() {
    setEditingDs({ id: '', name: '', enabled: true, config: { apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword' } })
    setEditingDsForm({ name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword' })
  }

  function openEditDs(src: CsDataSource) {
    setEditingDs(src)
    setEditingDsForm({
      name: src.name,
      apiKey: src.config.apiKey,
      spreadsheetId: src.config.spreadsheetId,
      sheetName: src.config.sheetName,
      keyColumn: src.config.keyColumn,
      returnColumns: src.config.returnColumns ?? [],
      triggerKeywords: src.config.triggerKeywords ?? [],
      triggerMode: src.config.triggerMode ?? 'keyword',
    })
  }

  async function saveDs() {
    setSavingDs(true)
    try {
      const config = {
        apiKey: editingDsForm.apiKey,
        spreadsheetId: editingDsForm.spreadsheetId,
        sheetName: editingDsForm.sheetName,
        keyColumn: editingDsForm.keyColumn,
        returnColumns: editingDsForm.returnColumns,
        triggerKeywords: editingDsForm.triggerKeywords,
        triggerMode: editingDsForm.triggerMode ?? 'keyword',
      }
      if (editingDs?.id) {
        const r = await fetch(`/api/marketing/cs-datasource/${editingDs.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingDsForm.name, config, enabled: editingDs.enabled }),
        })
        const d = await r.json()
        if (d.source) setDataSources(prev => prev.map(s => s.id === editingDs.id ? d.source : s))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingDsForm.name, config, industry: ind }),
        })
        const d = await r.json()
        if (d.source) setDataSources(prev => [...prev, d.source])
      }
      setEditingDs(null)
    } catch {}
    setSavingDs(false)
  }

  async function deleteDs(id: string) {
    setDsLoading(true)
    try {
      await fetch(`/api/marketing/cs-datasource/${id}`, { method: 'DELETE' })
      setDataSources(prev => prev.filter(s => s.id !== id))
    } catch {}
    setDsLoading(false)
  }

  async function saveBreakfast() {
    setSavingBreakfast(true)
    try {
      const config = {
        webhookUrl:   breakfastForm.webhookUrl.trim(),
        cutoffTime:   breakfastForm.cutoffTime.trim(),
        deliveryTime: breakfastForm.deliveryTime.trim(),
        rooms: breakfastForm.rooms.split('\n').map(s => s.trim()).filter(Boolean),
        menu:  breakfastForm.menu.split('\n').map(s => s.trim()).filter(Boolean),
      }
      if (breakfastCfgId) {
        await fetch(`/api/marketing/cs-datasource/${breakfastCfgId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '早餐直送設定', config, enabled: true }),
        })
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '早餐直送設定', type: 'breakfast_webhook', config, industry: ind }),
        })
        const d = await r.json()
        if (d.source) setBreakfastCfgId(d.source.id)
      }
    } catch {}
    setSavingBreakfast(false)
  }

  async function toggleDs(src: CsDataSource) {
    try {
      const r = await fetch(`/api/marketing/cs-datasource/${src.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: src.name, config: src.config, enabled: !src.enabled }),
      })
      const d = await r.json()
      if (d.source) setDataSources(prev => prev.map(s => s.id === src.id ? d.source : s))
    } catch {}
  }

  // Per-user credentials
  const [userId, setUserId] = useState<string | null>(null)
  const [platformCreds, setPlatformCreds] = useState<Record<string, Record<string, string>>>({})
  const [platformPreview, setPlatformPreview] = useState<Record<string, Record<string, string>>>({})
  const [platformConnected, setPlatformConnected] = useState<Record<string, boolean>>({})
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)
  const [telegramSetupLoading, setTelegramSetupLoading] = useState(false)
  const [telegramSetupResult, setTelegramSetupResult] = useState<{ ok: boolean; msg: string; webhookUrl?: string } | null>(null)
  const [telegramDiag, setTelegramDiag] = useState<{ info?: Record<string, unknown>; me?: Record<string, unknown>; recentChats?: Array<{ chatId: number; name: string; username?: string }>; endpointStatus?: number; error?: string } | null>(null)
  const [telegramDiagLoading, setTelegramDiagLoading] = useState(false)
  const [telegramTestChatId, setTelegramTestChatId] = useState('')
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // WhatsApp Personal (Baileys Bridge) states
  const [waQrData, setWaQrData] = useState<string | null>(null)  // base64 QR image
  const [waStatus, setWaStatus] = useState<string>('not_started') // 'not_started'|'connecting'|'qr'|'connected'|'disconnected'
  const [waPhone, setWaPhone] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)
  const waPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.id) setUserId(d.id) }).catch(() => {})
    fetch('/api/social/credentials').then(r => r.json()).then(d => {
      if (d.platforms) {
        const connected: Record<string, boolean> = {}
        const previewData: Record<string, Record<string, string>> = {}
        const valuesData: Record<string, Record<string, string>> = {}
        Object.entries(d.platforms).forEach(([k, v]) => {
          connected[k] = (v as any).is_connected
          previewData[k] = (v as any).preview ?? {}
          valuesData[k] = (v as any).values ?? {}
        })
        setPlatformConnected(connected)
        // Pre-populate form with actual values for non-secret fields
        setPlatformCreds(prev => {
          const next = { ...prev }
          Object.entries(valuesData).forEach(([platform, vals]) => {
            next[platform] = { ...(next[platform] ?? {}), ...vals }
          })
          return next
        })
        // Store preview for secret field indicators
        setPlatformPreview(previewData)
      }
    }).catch(() => {})
  }, [])

  async function savePlatformCreds(platformId: string) {
    const creds = platformCreds[platformId]
    if (!creds) return
    setSavingPlatform(platformId)
    try {
      await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformId, credentials: creds }),
      })
      setPlatformConnected(prev => ({ ...prev, [platformId]: Object.values(creds).some(v => v.trim()) }))
      setEditingPlatform(null)
    } catch {}
    setSavingPlatform(null)
  }

  async function registerTelegramWebhook() {
    setTelegramSetupLoading(true)
    setTelegramSetupResult(null)
    try {
      const res = await fetch('/api/marketing/telegram-setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setTelegramSetupResult({ ok: false, msg: data.error ?? '註冊失敗' })
      } else {
        const tgOk = data.setResult?.ok === true
        const webhookSet = data.infoResult?.result?.url ?? ''
        setTelegramSetupResult({
          ok: tgOk,
          msg: tgOk ? `Webhook 已成功註冊` : `Telegram 回傳：${JSON.stringify(data.setResult)}`,
          webhookUrl: webhookSet,
        })
      }
    } catch (e) {
      setTelegramSetupResult({ ok: false, msg: String(e) })
    }
    setTelegramSetupLoading(false)
  }

  async function checkTelegramDiag() {
    setTelegramDiagLoading(true)
    setTelegramDiag(null)
    try {
      const res = await fetch('/api/marketing/telegram-test')
      const data = await res.json()
      setTelegramDiag(data)
    } catch (e) {
      setTelegramDiag({ error: String(e) })
    }
    setTelegramDiagLoading(false)
  }

  async function sendTelegramTestMsg() {
    if (!telegramTestChatId.trim()) return
    setTelegramTestLoading(true)
    setTelegramTestResult(null)
    try {
      const res = await fetch('/api/marketing/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramTestChatId.trim() }),
      })
      const data = await res.json()
      const ok = data.result?.ok === true
      setTelegramTestResult({ ok, msg: ok ? '✅ 測試訊息已送出' : `❌ ${JSON.stringify(data.result?.description ?? data)}` })
    } catch (e) {
      setTelegramTestResult({ ok: false, msg: String(e) })
    }
    setTelegramTestLoading(false)
  }

  // ── WhatsApp Personal (Baileys) ────────────────────────────────────────────
  async function startWaSession() {
    setWaLoading(true)
    setWaError(null)
    setWaQrData(null)
    try {
      const r = await fetch('/api/marketing/wa-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setWaStatus(d.status ?? 'connecting')
      // Start polling for QR / connected status
      startWaPolling()
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : String(e))
    } finally {
      setWaLoading(false)
    }
  }

  function startWaPolling() {
    if (waPollingRef.current) clearInterval(waPollingRef.current)
    waPollingRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/marketing/wa-bridge?action=qr')
        const d = await r.json()
        setWaStatus(d.status ?? 'not_started')
        if (d.qr) setWaQrData(d.qr)
        if (d.phone) setWaPhone(d.phone)
        if (d.status === 'connected') {
          setWaQrData(null)
          clearInterval(waPollingRef.current!)
          waPollingRef.current = null
          // Save connected status to credentials
          await fetch('/api/social/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'whatsapp_personal', credentials: { whatsapp_personal_phone: d.phone ?? 'connected', connected: 'true' } }),
          })
          setPlatformConnected(prev => ({ ...prev, whatsapp_personal: true }))
        }
        if (['disconnected', 'not_started'].includes(d.status)) {
          clearInterval(waPollingRef.current!)
          waPollingRef.current = null
        }
      } catch { /* ignore */ }
    }, 3000)
  }

  async function disconnectWa() {
    setWaLoading(true)
    try {
      await fetch('/api/marketing/wa-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      setWaStatus('not_started')
      setWaQrData(null)
      setWaPhone(null)
      setPlatformConnected(prev => ({ ...prev, whatsapp_personal: false }))
    } catch { /* ignore */ } finally {
      setWaLoading(false)
    }
  }

  function getCredentialFields(platformId: string): { key: string; label: string; placeholder: string; secret: boolean }[] {
    const map: Record<string, { key: string; label: string; placeholder: string; secret: boolean }[]> = {
      line: [
        { key: 'line_channel_access_token', label: 'Channel Access Token', placeholder: 'U...', secret: true },
        { key: 'line_channel_secret', label: 'Channel Secret', placeholder: '...', secret: true },
      ],
      whatsapp: [
        { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', secret: false },
        { key: 'whatsapp_access_token', label: 'Access Token', placeholder: 'EAA...', secret: true },
        { key: 'whatsapp_verify_token', label: 'Verify Token（自訂任意字串）', placeholder: 'my_verify_token', secret: false },
      ],
      whatsapp_personal: [],  // QR-based auth, no manual fields needed
      telegram: [
        { key: 'telegram_bot_token', label: 'Bot Token（從 @BotFather 取得）', placeholder: '123456789:AAF...', secret: true },
        { key: 'telegram_admin_chat_id', label: '管理員 Chat ID（選填）', placeholder: '你的個人 Chat ID，從 @userinfobot 取得', secret: false },
      ],
      zalo: [
        { key: 'zalo_oa_access_token', label: 'OA Access Token', placeholder: '...', secret: true },
      ],
      wechat: [
        { key: 'wechat_app_id', label: 'App ID', placeholder: 'wx...', secret: false },
        { key: 'wechat_app_secret', label: 'App Secret', placeholder: '...', secret: true },
      ],
    }
    return map[platformId] ?? []
  }

  function saveSettings() {
    setSavingSettings(true)
    const filesToSave = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
    const data: Unit12Data = { systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: filesToSave, bookingFlowEnabled, paymentInfo, bookingFlows, vipList, autoCloseMinutes }
    onDone(data)
    setTimeout(() => setSavingSettings(false), 800)
  }

  async function sendTestMessage() {
    if (!testInput.trim()) return
    const userMsg = testInput.trim()
    setTestInput('')
    setTestHistory(prev => [...prev, { role: 'user', content: userMsg }])
    setTestLoading(true)

    try {
      // Dialogue files (CS-specific, highest priority) → Unit 2 company FAQ files (fallback)
      const dialogueTexts = (dialogueFiles)
        .filter(f => f.textContent)
        .map(f => `【知識庫｜${f.name}】\n${f.textContent}`)
        .join('\n\n')
      const faqTexts = (unit2Data?.files ?? [])
        .filter(f => f.textContent)
        .map(f => `【公司資料｜${f.name}】\n${f.textContent}`)
        .join('\n\n')
      const directText = knowledgeBase.trim() ? `【直接輸入知識】\n${knowledgeBase}` : ''
      const mergedKnowledge = [dialogueTexts, directText, faqTexts].filter(Boolean).join('\n\n')

      const res = await fetch('/api/marketing/cs-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: testHistory.slice(-6),
          systemPrompt,
          knowledgeBase: mergedKnowledge,
          escalationThreshold,
          language: replyLanguage,
          campaignId,
          bookingFlowEnabled,
          paymentInfo,
          bookingFlows,
        }),
      })
      const raw = await res.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any> = {}
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error(raw.slice(0, 200) || `伺服器回應錯誤 (HTTP ${res.status})`)
      }
      if (data.reply) {
        const newEntry: CsLogEntry = {
          message: userMsg,
          reply: data.reply,
          intent: data.intent,
          risk: data.risk,
          provider: data.provider,
          latencyMs: data.latencyMs,
          ts: new Date().toISOString(),
        }
        const msgMeta = { intent: data.intent, risk: data.risk, provider: data.provider }
        if (draftMode) {
          setDraftText(data.reply)
          setDraftMeta(msgMeta)
          setDraftUserMsg(userMsg)
          setTestHistory(prev => [...prev, { role: 'user', content: userMsg }])
        } else {
          setTestHistory(prev => [...prev, {
            role: 'assistant',
            content: data.reply,
            meta: msgMeta,
          }])
        }
        const updatedLogs = [newEntry, ...logs].slice(0, 100)
        setLogs(updatedLogs)
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs: updatedLogs, dialogueFiles, bookingFlowEnabled, paymentInfo, bookingFlows, vipList, autoCloseMinutes })
        // 保存到統一收件匣
        saveTestMessageToInbox(userMsg, data.reply, data.intent, data.risk, data.latencyMs)
      } else {
        setTestHistory(prev => [...prev, { role: 'assistant', content: `錯誤：${data.error ?? '未知錯誤'}` }])
      }
    } catch (e) {
      setTestHistory(prev => [...prev, { role: 'assistant', content: `連線錯誤：${String(e)}` }])
    }
    setTestLoading(false)
  }

  // 對話摘要
  async function summarizeConversation() {
    if (!testHistory.length) return
    setSummarizing(true)
    setSummary('')
    try {
      const res = await fetch('/api/marketing/cs-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: testHistory }),
      })
      const d = await res.json()
      if (d.summary) setSummary(d.summary)
    } finally {
      setSummarizing(false)
    }
  }

  // 採用草稿送出
  function adoptDraft() {
    if (!draftText) return
    setTestHistory(prev => [...prev, {
      role: 'assistant',
      content: draftText,
      meta: draftMeta ?? undefined,
    }])
    setDraftText('')
    setDraftMeta(null)
    setDraftUserMsg('')
  }

  // 捨棄草稿
  function discardDraft() {
    setDraftText('')
    setDraftMeta(null)
    setDraftUserMsg('')
  }

  // 自動滿意度問卷 / 結案
  function closeCase() {
    const surveyMsg = '感謝您的聯繫！請問本次問題有解決您的疑慮嗎？\n\n1️⃣ 已解決，非常滿意\n2️⃣ 已解決，尚可\n3️⃣ 未解決，需進一步協助\n\n如有其他問題，歡迎隨時聯繫我們 🙏'
    setTestHistory(prev => [...prev, { role: 'assistant', content: surveyMsg }])
    setCaseClosed(true)
    startAutoCloseTimer()
  }

  // 流失預警偵測
  const isChurnWarning = (meta?: { intent?: string; risk?: string }) => {
    if (!meta) return false
    const churnKeywords = ['取消', '退訂', '不用了', '不想', '考慮', '流失', '解約', '退出', '不再']
    const intentStr = (meta.intent ?? '').toLowerCase()
    return meta.risk === 'high' || churnKeywords.some(k => intentStr.includes(k))
  }

  const riskColor = (r: string) =>
    r === 'high' ? 'text-red-600 bg-red-50' :
    r === 'medium' ? 'text-amber-600 bg-amber-50' :
    'text-green-600 bg-green-50'

  // 行業測試語句
  const INDUSTRY_TEST_PHRASES: Record<string, string[]> = {
    homestay: ['有哪些房型？', '這週末還有空房嗎？', '可以加床嗎？幾人入住？', '退訂政策是什麼？', '附近有什麼景點推薦？', 'Do you have rooms available this weekend?'],
    ecommerce: ['我的訂單還沒到', '我想退換貨', '促銷活動什麼時候結束？', '這個商品還有庫存嗎？', '物流追蹤號碼是多少？', '운송 중인 주문을 추적하려면 어떻게 해야 합니까?'],
    restaurant: ['我想訂位，4人，週五晚上', '你們有素食餐點嗎？', '外送範圍和時間？', '包廂需要預約嗎？', '今日特餐是什麼？', 'Can I make a reservation for 2 people tonight?'],
    clinic: ['我想預約下週的療程', '這個療程需要多久恢復？', '費用大概多少？', '術後有什麼注意事項？', '醫師的資歷是什麼？', 'What are the side effects of this treatment?'],
    beauty: ['我想預約洗剪吹', '請問哪位設計師有空？', '燙髮大概多少錢？', '需要提前多久預約？', '你們有護髮療程嗎？', 'Can I book a hair treatment for tomorrow?'],
    education: ['我想了解英文課程', '有試聽課程嗎？', '學費方案有哪些？', '老師的教學方式是什麼？', '孩子幾歲可以開始學？', 'What courses do you offer for beginners?'],
  }

  // VIP 識別
  const vipNames = vipList.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)
  const isVipMessage = (text: string) => vipNames.some(v => text.toLowerCase().includes(v))

  // 載入 tickets
  async function loadTickets() {
    setTicketsLoading(true)
    try {
      const res = await fetch(`/api/marketing/cs-tickets?industry=${ind}`)
      const d = await res.json()
      if (d.tickets) setTickets(d.tickets)
    } finally {
      setTicketsLoading(false)
    }
  }

  // 建立工單 from current test conversation
  async function createTicketFromConversation() {
    if (!testHistory.length) return
    setCreatingTicket(true)
    const lastUserMsg = [...testHistory].reverse().find(m => m.role === 'user')
    const lastAiMsg = [...testHistory].reverse().find(m => m.role === 'assistant')
    const subject = lastUserMsg?.content?.slice(0, 50) ?? '客服工單'
    const description = testHistory.map(m => `${m.role === 'user' ? '客戶' : 'AI'}：${m.content}`).join('\n')
    const highRiskMsg = [...testHistory].reverse().find(m => m.role === 'assistant' && m.meta?.risk === 'high')
    const priority = highRiskMsg ? 'high' : 'medium'
    const intent = lastAiMsg?.meta?.intent
    try {
      const res = await fetch('/api/marketing/cs-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: ind, subject, description, priority, intent, messages: testHistory, campaign_id: campaignId }),
      })
      const d = await res.json()
      if (d.ticket) {
        setTickets(prev => [d.ticket, ...prev])
        setTab('tickets')
      }
    } finally {
      setCreatingTicket(false)
    }
  }

  // 載入收件匣
  async function loadInbox() {
    setInboxLoading(true)
    try {
      const url = inboxPlatformFilter !== 'all'
        ? `/api/marketing/cs-messages?industry=${ind}&platform=${inboxPlatformFilter}`
        : `/api/marketing/cs-messages?industry=${ind}`
      const res = await fetch(url)
      const d = await res.json()
      if (d.messages) setInboxMessages(d.messages)
    } finally {
      setInboxLoading(false)
    }
  }

  // 儲存測試對話到收件匣
  async function saveTestMessageToInbox(userMsg: string, reply: string, intent: string, risk: string, latencyMs: number) {
    try {
      await fetch('/api/marketing/cs-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: ind, platform: 'test', from_id: 'test_user', from_name: '測試用戶', message: userMsg, reply, intent, risk, latency_ms: latencyMs, campaign_id: campaignId }),
      })
    } catch { /* silent */ }
  }

  // 自動結案倒數
  function startAutoCloseTimer() {
    if (!autoCloseMinutes || autoCloseMinutes <= 0) return
    const totalSec = autoCloseMinutes * 60
    setAutoCloseSecondsLeft(totalSec)
    if (autoCloseTimerRef.current) clearInterval(autoCloseTimerRef.current)
    autoCloseTimerRef.current = setInterval(() => {
      setAutoCloseSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(autoCloseTimerRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const ticketStatusColor = (s: string) =>
    s === 'open' ? 'text-blue-600 bg-blue-50' :
    s === 'in_progress' ? 'text-amber-600 bg-amber-50' :
    s === 'resolved' ? 'text-green-600 bg-green-50' :
    'text-gray-500 bg-gray-100'
  const ticketStatusLabel = (s: string) =>
    s === 'open' ? '待處理' : s === 'in_progress' ? '處理中' : s === 'resolved' ? '已解決' : '已結案'
  const ticketPriorityColor = (p: string) =>
    p === 'urgent' ? 'text-red-600 bg-red-50' :
    p === 'high' ? 'text-orange-600 bg-orange-50' :
    p === 'medium' ? 'text-indigo-600 bg-indigo-50' :
    'text-gray-500 bg-gray-100'
  const ticketPriorityLabel = (p: string) =>
    p === 'urgent' ? '緊急' : p === 'high' ? '高' : p === 'medium' ? '中' : '低'
  const platformEmoji = (p: string) =>
    p === 'line' ? '💬' : p === 'whatsapp' ? '📱' : p === 'telegram' ? '✈️' : p === 'test' ? '🧪' : '💌'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Headphones className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            智能客服系統
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Gemini Flash 意圖分類 · Claude Sonnet 高風險升級</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['platforms', 'ai-settings', 'dialogue-files', 'data-sources', 'pricing', 'test', 'logs', 'tickets', 'inbox'] as Cs12Tab[]).map(t => {
            const labels: Record<Cs12Tab, string> = {
              platforms: '平台', 'ai-settings': 'AI 設定', 'dialogue-files': '知識庫',
              'data-sources': '資料來源', pricing: '定價計算機', test: '測試', logs: '記錄',
              tickets: `工單${tickets.filter(tk => tk.status === 'open' || tk.status === 'in_progress').length > 0 ? ` (${tickets.filter(tk => tk.status === 'open' || tk.status === 'in_progress').length})` : ''}`,
              inbox: '收件匣',
            }
            const isNew = (t === 'tickets' || t === 'inbox') && tab !== t
            return (
              <button key={t}
                onClick={() => {
                  setTab(t)
                  if (t === 'tickets') loadTickets()
                  if (t === 'inbox') loadInbox()
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                  tab === t ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={tab === t ? { background: 'var(--primary)' } : {}}>
                {labels[t]}
                {isNew && t === 'inbox' && inboxMessages.length === 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab: Platforms ──────────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            設定各平台的 API Key，再將 Webhook URL 複製到對應平台後台。
          </p>
          <div className="grid grid-cols-1 gap-3">
            {CS_PLATFORMS.map(p => (
              <div key={p.id} className="border rounded-xl p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    <span className="font-medium text-sm text-gray-800">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${platformConnected[p.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {platformConnected[p.id] ? '已連線' : '未設定'}
                    </span>
                    {p.id !== 'whatsapp_personal' && (
                      <button onClick={() => setEditingPlatform(editingPlatform === p.id ? null : p.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                        設定
                      </button>
                    )}
                  </div>
                </div>

                {/* Webhook URL */}
                {p.showWebhook && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-700 font-mono truncate">
                      {appUrl}/api/marketing/cs-webhook/{p.id}/{userId ?? '(登入後顯示)'}
                    </code>
                    <button onClick={() => userId && navigator.clipboard.writeText(`${appUrl}/api/marketing/cs-webhook/${p.id}/${userId}`)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 whitespace-nowrap">
                      複製
                    </button>
                  </div>
                )}

                {/* Note */}
                <p className="text-[10px] text-gray-400">
                  {p.note}
                  {p.docUrl && (
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="ml-1.5 text-indigo-400 hover:text-indigo-600 underline">
                      官方說明 ↗
                    </a>
                  )}
                </p>

                {/* Telegram — diagnostic panel */}
                {p.id === 'telegram' && platformConnected['telegram'] && (
                  <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
                    {/* Row 1: register + diagnose */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={registerTelegramWebhook} disabled={telegramSetupLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 disabled:opacity-50">
                        {telegramSetupLoading ? '註冊中...' : '🔗 重新註冊 Webhook'}
                      </button>
                      <button onClick={checkTelegramDiag} disabled={telegramDiagLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 disabled:opacity-50">
                        {telegramDiagLoading ? '查詢中...' : '🔍 查看錯誤狀態'}
                      </button>
                    </div>

                    {/* Register result */}
                    {telegramSetupResult && (
                      <div className={`text-[10px] rounded-lg px-3 py-2 ${telegramSetupResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {telegramSetupResult.msg}
                        {telegramSetupResult.webhookUrl && <div className="mt-0.5 font-mono break-all opacity-70">{telegramSetupResult.webhookUrl}</div>}
                      </div>
                    )}

                    {/* Diag result */}
                    {telegramDiag && (
                      <div className="text-[10px] rounded-lg px-3 py-2 bg-gray-800 text-gray-100 space-y-1 font-mono">
                        {/* Endpoint self-check */}
                        {telegramDiag.endpointStatus != null && (
                          <div className={telegramDiag.endpointStatus === 200 ? 'text-green-400' : 'text-red-400'}>
                            🌐 Webhook 端點: HTTP {telegramDiag.endpointStatus}
                            {telegramDiag.endpointStatus === 307 ? ' ← 仍被重導，等待 Vercel 部署完成後再試' : ''}
                            {telegramDiag.endpointStatus === 200 ? ' ← 正常可存取' : ''}
                          </div>
                        )}
                        {/* Bot info */}
                        {(telegramDiag.me as any)?.ok && (
                          <div>🤖 Bot: @{(telegramDiag.me as any).result?.username} ({(telegramDiag.me as any).result?.first_name})</div>
                        )}
                        {/* Webhook info */}
                        {(telegramDiag.info as any)?.ok && (() => {
                          const r = (telegramDiag.info as any).result
                          return (
                            <>
                              <div>🔗 Webhook URL: <span className="break-all opacity-70">{r.url || '（未設定）'}</span></div>
                              <div>📬 Pending updates: {r.pending_update_count ?? 0}</div>
                              {r.last_error_message && (
                                <>
                                  <div className={telegramDiag?.endpointStatus === 200 ? 'text-yellow-400' : 'text-red-400'}>
                                    {telegramDiag?.endpointStatus === 200 ? '⚠️' : '❌'} 最後錯誤: {r.last_error_message}
                                  </div>
                                  {r.last_error_date && (
                                    <div className="text-gray-400 opacity-70">   時間: {new Date(r.last_error_date * 1000).toLocaleString()}</div>
                                  )}
                                  {telegramDiag?.endpointStatus === 200 && (
                                    <div className="text-green-400">   ✅ 此為歷史錯誤，目前 Webhook 端點已正常（HTTP 200）</div>
                                  )}
                                </>
                              )}
                              {!r.last_error_message && r.url && (
                                <div className="text-green-400">✅ Webhook 正常，無錯誤紀錄</div>
                              )}
                            </>
                          )
                        })()}
                        {telegramDiag.recentChats && telegramDiag.recentChats.length > 0 && (
                          <div className="mt-1">
                            <div className="text-gray-400 mb-0.5">最近對話（點選填入）：</div>
                            {telegramDiag.recentChats.map(c => (
                              <button key={c.chatId} onClick={() => setTelegramTestChatId(String(c.chatId))}
                                className="mr-1 mb-1 text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-white">
                                {c.name}{c.username ? ` @${c.username}` : ''} ({c.chatId})
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Admin Chat ID status */}
                        {(() => {
                          const adminId = platformCreds['telegram']?.telegram_admin_chat_id
                          return adminId
                            ? <div className="text-blue-300">👤 管理員 Chat ID: <span className="text-white">{adminId}</span> ← 客戶訊息會轉發至此</div>
                            : <div className="text-yellow-400">⚠️ 未設定管理員 Chat ID，客戶訊息不會轉發給你。請到「設定憑證」填入你的 Chat ID（可從 @userinfobot 取得）</div>
                        })()}
                        {!(telegramDiag.me as any)?.ok && <div className="text-red-400">❌ Bot Token 無效：{JSON.stringify((telegramDiag.me as any)?.description)}</div>}
                      </div>
                    )}

                    {/* Row 2: send test message */}
                    <div className="border-t border-blue-100 pt-2 space-y-1.5">
                      <p className="text-[10px] text-gray-500">傳送測試訊息（先點「查看錯誤狀態」自動抓取 Chat ID）</p>
                      <div className="flex gap-2">
                        <input
                          value={telegramTestChatId}
                          onChange={e => setTelegramTestChatId(e.target.value)}
                          placeholder="Chat ID，例如 123456789"
                          className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={sendTelegramTestMsg} disabled={telegramTestLoading || !telegramTestChatId.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-green-50 text-green-700 border border-green-200 disabled:opacity-50 whitespace-nowrap">
                          {telegramTestLoading ? '送出中...' : '📨 送出'}
                        </button>
                      </div>
                      {telegramTestResult && (
                        <div className={`text-[10px] rounded-lg px-3 py-1.5 ${telegramTestResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {telegramTestResult.msg}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* WhatsApp Personal — QR scan UI */}
                {p.id === 'whatsapp_personal' && (
                  <div className="space-y-3">
                    {/* Status bar */}
                    <div className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      waStatus === 'connected' ? 'bg-green-50 text-green-700 border border-green-200' :
                      waStatus === 'qr' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      waStatus === 'connecting' || waStatus === 'reconnecting' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                      'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      <span>
                        {waStatus === 'connected' && waPhone && `✅ 已連線：+${waPhone}`}
                        {waStatus === 'connected' && !waPhone && '✅ WhatsApp 已連線'}
                        {waStatus === 'qr' && '📱 請用 WhatsApp 掃描下方 QR Code'}
                        {waStatus === 'connecting' && '⏳ 連線中...'}
                        {waStatus === 'reconnecting' && '🔄 重新連線中...'}
                        {waStatus === 'not_started' && '未連線'}
                        {waStatus === 'disconnected' && '❌ 已斷線，請重新連線'}
                      </span>
                      {waStatus === 'connected'
                        ? <button onClick={disconnectWa} disabled={waLoading}
                            className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">
                            {waLoading ? '...' : '斷線'}
                          </button>
                        : <button onClick={startWaSession} disabled={waLoading || waStatus === 'connecting' || waStatus === 'qr'}
                            className="text-[10px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                            {waLoading ? '啟動中...' : waStatus === 'qr' ? '等待掃描...' : '📱 掃 QR 連線'}
                          </button>
                      }
                    </div>

                    {/* QR code */}
                    {waQrData && waStatus === 'qr' && (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <img src={waQrData} alt="WhatsApp QR Code"
                          className="w-48 h-48 rounded-xl border-4 border-green-200 shadow" />
                        <p className="text-[10px] text-gray-500 text-center">
                          打開 WhatsApp → 選「已連結的裝置」→ 掃描此 QR Code
                        </p>
                      </div>
                    )}

                    {waError && (
                      <div className="text-[10px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        ❌ {waError}
                        {waError.includes('WHATSAPP_BRIDGE_URL') && (
                          <div className="mt-1 text-red-500">請先在 Vercel 環境變數設定 WHATSAPP_BRIDGE_URL 和 WHATSAPP_BRIDGE_API_KEY</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Credential inputs (when editing) */}
                {editingPlatform === p.id && (
                  <div className="space-y-2 border-t pt-3">
                    {getCredentialFields(p.id).map(field => {
                      const isSet = field.secret
                        ? !!(platformPreview[p.id]?.[field.key])
                        : false
                      return (
                        <div key={field.key}>
                          <label className="text-[10px] text-gray-500 block mb-1">
                            {field.label}
                            {isSet && <span className="ml-1 text-green-500">✓ 已設定</span>}
                          </label>
                          <input
                            type={field.secret ? 'password' : 'text'}
                            placeholder={isSet ? '留空保留原值' : field.placeholder}
                            value={platformCreds[p.id]?.[field.key] ?? ''}
                            onChange={e => setPlatformCreds(prev => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], [field.key]: e.target.value }
                            }))}
                            className="w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      )
                    })}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => savePlatformCreds(p.id)} disabled={savingPlatform === p.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: 'var(--primary)' }}>
                        {savingPlatform === p.id ? '儲存中...' : '儲存'}
                      </button>
                      <button onClick={() => setEditingPlatform(null)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600">
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: AI Settings ────────────────────────────────────────────────── */}
      {tab === 'ai-settings' && (
        <div className="space-y-4">

          {/* Industry template banner */}
          {industry && CS_INDUSTRY_TEMPLATES[industry] && (
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CS_INDUSTRY_TEMPLATES[industry].emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-violet-800">{CS_INDUSTRY_TEMPLATES[industry].label} 模板</div>
                    <div className="text-xs text-violet-500">套用預設系統提示詞與引導流程</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const tpl = CS_INDUSTRY_TEMPLATES[industry]
                    setSystemPrompt(tpl.systemPrompt)
                    if (!knowledgeBase) setKnowledgeBase(tpl.knowledgeBase)
                    setBookingFlowEnabled(tpl.bookingFlowEnabled)
                    setBookingFlows(tpl.bookingFlows)
                  }}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                >
                  套用模板
                </button>
              </div>
              {!systemPrompt && (
                <div className="text-xs text-violet-600 bg-violet-100 rounded-lg px-3 py-2">
                  💡 尚未設定系統提示詞，點「套用模板」快速啟動
                </div>
              )}
            </div>
          )}

          {/* Industry template selector (no industry in URL) */}
          {!industry && !systemPrompt && (
            <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">快速套用行業模板</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CS_INDUSTRY_TEMPLATES).map(([id, tpl]) => (
                  <button key={id}
                    onClick={() => {
                      setSystemPrompt(tpl.systemPrompt)
                      if (!knowledgeBase) setKnowledgeBase(tpl.knowledgeBase)
                      setBookingFlowEnabled(tpl.bookingFlowEnabled)
                      setBookingFlows(tpl.bookingFlows)
                    }}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 border border-gray-200 text-xs text-gray-700 transition-colors text-left"
                  >
                    <span>{tpl.emoji}</span>
                    <span className="truncate">{tpl.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Routing info */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
            <div className="font-medium text-sm text-indigo-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />AI 路由架構
            </div>
            <div className="flex items-center gap-3 text-xs text-indigo-700">
              <div className="flex flex-col items-center gap-1">
                <div className="px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-300 font-medium">Gemini 2.0 Flash</div>
                <div className="text-[10px] text-gray-500">意圖分類 · 低/中風險回覆</div>
              </div>
              <div className="text-gray-400 text-lg">→</div>
              <div className="flex flex-col items-center gap-1">
                <div className="px-3 py-1.5 rounded-lg bg-orange-100 border border-orange-300 font-medium">Claude Sonnet</div>
                <div className="text-[10px] text-gray-500">高風險升級 · 複雜問題</div>
              </div>
            </div>
            <div className="text-xs text-indigo-600">
              高風險意圖：<span className="font-medium">退換貨/退款、投訴/抱怨、法律/合約</span>（自動升級至 Claude）
            </div>
          </div>

          {/* Escalation threshold */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="font-medium text-sm text-gray-700">升級閾值</span>
            <div className="flex gap-3">
              {([
                { value: 'high', label: '高風險才升級', desc: '僅投訴/退款/法律 → Claude', color: 'red' },
                { value: 'medium', label: '中風險以上升級', desc: '中+高風險均 → Claude', color: 'amber' },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setEscalationThreshold(opt.value)}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    escalationThreshold === opt.value
                      ? `border-${opt.color}-400 bg-${opt.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-xs text-gray-800">{opt.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reply language */}
          <div className="border rounded-xl p-4 space-y-2">
            <span className="font-medium text-sm text-gray-700">回覆語言</span>
            <select value={replyLanguage} onChange={e => setReplyLanguage(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="auto">自動偵測（跟隨客戶語言）</option>
              <option value="繁體中文">繁體中文</option>
              <option value="简体中文">简体中文</option>
              <option value="English">English</option>
              <option value="Tiếng Việt">Tiếng Việt（越南語）</option>
              <option value="日本語">日本語</option>
              <option value="한국어">한국어</option>
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="ภาษาไทย">ภาษาไทย（泰語）</option>
            </select>
          </div>

          {/* System Prompt */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-2 bg-indigo-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-700">系統提示詞（System Prompt）</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">AI 角色設定</span>
              </div>
              <span className="text-xs text-gray-400">{systemPrompt.length} 字</span>
            </div>
            <p className="text-xs text-gray-500">定義 AI 客服的<strong>角色、語氣與行為準則</strong>。例如：「你是 XX 品牌的客服，請用親切語氣回覆」。<br />⚠️ 這裡<strong>不是</strong>放 FAQ 或產品資料，那些請到「知識庫」分頁設定。</p>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="例：你是 AI GATE 的專業客服，請用親切且專業的語氣回答客戶問題。若無法確定答案，請主動告知將轉交人工客服處理。"
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* Booking flow toggle + multi-flow config */}
          <div className="border-2 border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-700">預訂引導流程</div>
                <div className="text-xs text-gray-500 mt-0.5">開啟後 AI 依客人意圖自動觸發對應流程，逐步收集預訂資料</div>
              </div>
              <button
                onClick={() => setBookingFlowEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bookingFlowEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bookingFlowEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {bookingFlowEnabled && (
              <div className="space-y-3">
                {/* Flow list */}
                {bookingFlows.map((flow, fi) => (
                  <div key={flow.id} className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">{flow.name || `流程 ${fi + 1}`}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingFlow({ ...flow })}
                          className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">編輯</button>
                        <button onClick={() => setBookingFlows(prev => prev.filter((_, i) => i !== fi))}
                          className="text-[10px] px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">刪除</button>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      觸發關鍵字：<span className="text-emerald-700 font-medium">{flow.triggerKeywords || '(未設定)'}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      收集步驟：{flow.steps.map(s => BOOKING_STEP_LABELS[s]).join(' → ')}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setEditingFlow({ id: `flow_${Date.now()}`, name: '', triggerKeywords: '', dataHint: '', steps: ['date_depart', 'timeslot', 'headcount', 'phone'], paymentInfo: '' })}
                  className="w-full py-2 rounded-xl text-xs font-medium border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> 新增預訂類型
                </button>

                {/* Global payment info */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">預設付款說明（各流程未設定時使用）</div>
                  <textarea
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    rows={2}
                    placeholder="例：請匯款至玉山銀行 123-456789 戶名：OO 公司，匯款後傳收據截圖確認。"
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flow editor modal */}
          {editingFlow && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEditingFlow(null) }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-800">設定預訂流程</h3>
                  <button onClick={() => setEditingFlow(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">流程名稱</label>
                  <input value={editingFlow.name} onChange={e => setEditingFlow(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder="例：賞鯨行程預訂、訂房、停車"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Trigger keywords */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">觸發關鍵字（逗號分隔）</label>
                  <p className="text-[10px] text-gray-400">客人說到這些字詞時，AI 自動啟動此流程</p>
                  <input value={editingFlow.triggerKeywords} onChange={e => setEditingFlow(f => f ? { ...f, triggerKeywords: e.target.value } : f)}
                    placeholder="例：賞鯨,出海,繞島,訂票"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Data hint */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">關聯資料關鍵字</label>
                  <p className="text-[10px] text-gray-400">告訴 AI 要從知識庫和定價計算機中找哪一類資料。<br />例：賞鯨行程 → 填「賞鯨」；訂房 → 填「房型」或房間名稱</p>
                  <input value={editingFlow.dataHint ?? ''} onChange={e => setEditingFlow(f => f ? { ...f, dataHint: e.target.value } : f)}
                    placeholder="例：賞鯨、海景大床房、停車"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">收集步驟（勾選 + 拖排順序）</label>
                  <p className="text-[10px] text-gray-400">AI 依序詢問已勾選的步驟</p>
                  <div className="space-y-1.5">
                    {(Object.keys(BOOKING_STEP_LABELS) as BookingStep[]).map(step => {
                      const checked = editingFlow.steps.includes(step)
                      const idx = editingFlow.steps.indexOf(step)
                      return (
                        <div key={step} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            setEditingFlow(f => {
                              if (!f) return f
                              const steps = e.target.checked
                                ? [...f.steps, step]
                                : f.steps.filter(s => s !== step)
                              return { ...f, steps }
                            })
                          }} className="w-3.5 h-3.5 accent-emerald-500" />
                          <span className="flex-1 text-xs text-gray-700">{BOOKING_STEP_LABELS[step]}</span>
                          {checked && (
                            <div className="flex gap-1">
                              <button disabled={idx === 0} onClick={() => setEditingFlow(f => {
                                if (!f) return f
                                const s = [...f.steps]; [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]]; return { ...f, steps: s }
                              })} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↑</button>
                              <button disabled={idx === editingFlow.steps.length - 1} onClick={() => setEditingFlow(f => {
                                if (!f) return f
                                const s = [...f.steps]; [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]]; return { ...f, steps: s }
                              })} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↓</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Payment info per flow */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">付款說明（此流程專用，留空則用預設）</label>
                  <textarea value={editingFlow.paymentInfo} onChange={e => setEditingFlow(f => f ? { ...f, paymentInfo: e.target.value } : f)}
                    rows={2}
                    placeholder="例：請轉帳至 ..."
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingFlow(null)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">取消</button>
                  <button onClick={() => {
                    if (!editingFlow) return
                    setBookingFlows(prev => {
                      const idx = prev.findIndex(f => f.id === editingFlow.id)
                      return idx >= 0 ? prev.map((f, i) => i === idx ? editingFlow : f) : [...prev, editingFlow]
                    })
                    setEditingFlow(null)
                  }} className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'var(--primary)' }}>
                    儲存此流程
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── VIP 識別 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">VIP 客戶名單</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">已上線</span>
            </div>
            <p className="text-xs text-gray-500">每行一個關鍵字（客戶名稱、Line 暱稱、手機號後4碼等）。對話中偵測到時，自動顯示「VIP 優先處理」標示。</p>
            <textarea
              value={vipList}
              onChange={e => setVipList(e.target.value)}
              rows={4}
              placeholder={'王小明\n0912\nVIP001\nJohn Wang'}
              className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none font-mono"
            />
          </div>

          {/* ── 自動結案 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">自動結案</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">已上線</span>
            </div>
            <p className="text-xs text-gray-500">按下「結案」後，若客戶在指定時間內無回應，系統自動關閉工單。設為 0 表示不自動結案。</p>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={120}
                value={autoCloseMinutes}
                onChange={e => setAutoCloseMinutes(Number(e.target.value))}
                className="w-24 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-500">分鐘後自動結案</span>
              {autoCloseMinutes > 0 && <span className="text-xs text-green-600">✓ 已啟用</span>}
            </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--primary)' }}>
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : <><CheckCircle2 className="h-4 w-4" />儲存設定</>}
          </button>

          {/* Env hint */}
          <div className="bg-gray-50 border rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600">需要設定的環境變數：</div>
            <div className="flex gap-2 flex-wrap">
              <code className="bg-blue-100 px-1.5 py-0.5 rounded">GOOGLE_AI_API_KEY</code>
              <code className="bg-orange-100 px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Dialogue Files ─────────────────────────────────────────────── */}
      {tab === 'dialogue-files' && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700">知識庫</div>
            <div className="text-xs text-gray-400 mt-0.5">AI 客服優先從這裡查找答案，找不到才回到公司資料（Unit 2）</div>
          </div>

          {/* Direct text input */}
          <div className="border-2 border-green-200 rounded-xl p-4 space-y-2 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">直接輸入知識內容</span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">FAQ / 產品資料</span>
              </div>
              <span className="text-xs text-gray-400">{knowledgeBase.length} 字</span>
            </div>
            <p className="text-xs text-gray-500">放 FAQ、產品規格、價格等<strong>具體資訊</strong>，AI 客服會從這裡查找答案。<br />這裡<strong>不是</strong> Prompt 設定，Prompt 請到「AI 設定」分頁設定。</p>
            <textarea
              value={knowledgeBase}
              onChange={e => setKnowledgeBase(e.target.value)}
              rows={8}
              placeholder="例：&#10;Q: 如何申請試用？&#10;A: 請至官網填寫申請表，我們會在 1 個工作天內回覆。&#10;&#10;Q: 收費方案為何？&#10;A: 我們提供月繳與年繳方案，詳情請參考官網定價頁面。"
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
            />
          </div>

          {/* File upload */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-gray-600">上傳文件（PDF / DOCX / XLSX / CSV / TXT）</span>
            <div
              onClick={() => !uploadingDialogue && dialogueInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${uploadingDialogue ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              <input
                ref={dialogueInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleDialogueUpload(f); e.target.value = '' }}
              />
              {uploadingDialogue
                ? <><Loader2 className="h-5 w-5 text-gray-400 mx-auto mb-1 animate-spin" /><p className="text-xs text-gray-500">上傳中…</p></>
                : <><Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" /><p className="text-xs text-gray-500">點擊上傳 · 最大 50MB</p></>
              }
            </div>
            {(() => {
              // Always show files from either local state or saved DB data
              const displayFiles = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
              return displayFiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">尚未上傳任何文件</p>
              ) : (
                <div className="space-y-1.5">
                  {displayFiles.map(f => (
                    <div key={f.url} className="flex items-center gap-3 p-2.5 rounded-lg border bg-gray-50">
                      <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400">{f.sizeKb} KB · {f.textContent ? `已萃取 ${f.textContent.length.toLocaleString()} 字` : '無文字內容'}</p>
                      </div>
                      <button onClick={() => removeDialogueFile(f.url)} className="text-gray-400 hover:text-red-500 transition-colors" title="刪除此檔案">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Save */}
          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--primary)' }}>
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</> : <><CheckCircle2 className="h-4 w-4" />儲存知識庫</>}
          </button>
        </div>
      )}

      {/* ── Tab: Data Sources ───────────────────────────────────────────────── */}
      {tab === 'data-sources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">外部資料來源</div>
              <div className="text-xs text-gray-400 mt-0.5">客戶輸入觸發關鍵字時，AI 自動查詢對應 Google Sheets</div>
            </div>
            <button onClick={openAddDs}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
              style={{ background: 'var(--primary)' }}>
              <Plus className="h-3.5 w-3.5" />新增
            </button>
          </div>

          {/* Industry recommended sheets guide */}
          {industry && CS_INDUSTRY_TEMPLATES[industry] && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{CS_INDUSTRY_TEMPLATES[industry].emoji}</span>
                <div className="font-medium text-sm text-blue-800">建議設定的 Google Sheets（{CS_INDUSTRY_TEMPLATES[industry].label}）</div>
              </div>
              <div className="space-y-2">
                {CS_INDUSTRY_TEMPLATES[industry].recommendedSheets.map((sheet, i) => (
                  <div key={i} className="bg-white rounded-lg border border-blue-100 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">表格 {i + 1}</span>
                      <span className="text-xs font-semibold text-gray-800">{sheet.name}</span>
                      <span className="text-[10px] text-gray-400">{sheet.description}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      <div>查詢欄位：<span className="text-gray-700 font-medium">{sheet.keyColumn}</span></div>
                      <div>回傳欄位範例：<span className="text-gray-600">{sheet.returnColumnsExample}</span></div>
                      <div>觸發詞：<span className="text-blue-600">{sheet.triggerKeywords}</span>　觸發模式：<span className="font-medium">{sheet.triggerMode === 'numeric' ? '數字觸發' : sheet.triggerMode === 'both' ? '關鍵字+數字' : '關鍵字觸發'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-blue-600 space-y-0.5">
                <div>💡 <strong>定價查詢</strong>請到「定價計算機」分頁設定 — 這裡只放需要即時查詢的非定價資料（訂單、排班、時段）</div>
                <div>👉 依照上方建議建立 Google Sheets 後，點「新增」填入 API Key 和 Spreadsheet ID</div>
              </div>
            </div>
          )}

          {dsLoading && <div className="text-xs text-gray-400 text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />載入中…</div>}

          {dataSources.length === 0 && !dsLoading && !editingDs && (
            <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2">
              <div className="text-sm text-gray-400">尚無資料來源。點擊「新增」設定 Google Sheets 查詢。</div>
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-left space-y-1">
                <div className="font-medium text-gray-600">📌 工具分工說明</div>
                <div>• <span className="font-medium">Google Sheets（此頁）</span>：訂單查詢、排班、可用時段等即時動態資料</div>
                <div>• <span className="font-medium">定價計算機</span>：房型/療程/套餐等定價計算，AI 自動套公式報價</div>
                <div>• <span className="font-medium">知識庫</span>：FAQ、政策說明、靜態產品介紹</div>
              </div>
            </div>
          )}

          {dataSources.length > 0 && !editingDs && (
            <div className="space-y-2">
              {dataSources.map(src => (
                <div key={src.id} className="border rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{src.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                      觸發詞：{(src.config.triggerKeywords ?? []).join('、') || '（未設定）'}
                    </div>
                  </div>
                  <button onClick={() => toggleDs(src)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${src.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {src.enabled ? '啟用' : '停用'}
                  </button>
                  <button onClick={() => openEditDs(src)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">編輯</button>
                  <button onClick={() => deleteDs(src.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">刪除</button>
                </div>
              ))}
            </div>
          )}

          {editingDs !== null && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="font-medium text-sm text-gray-700">{editingDs.id ? '編輯資料來源' : '新增資料來源'}</div>

              {[
                { key: 'name', label: '名稱', placeholder:
                    industry === 'ecommerce' ? '例：訂單查詢表、商品目錄' :
                    industry === 'restaurant' ? '例：菜單定價、訂位時段表' :
                    industry === 'clinic' ? '例：療程費用表、醫師排班' :
                    industry === 'beauty' ? '例：服務價目表、設計師排班' :
                    industry === 'education' ? '例：課程學費表、試聽時段' :
                    '例：訂單密碼表、房型定價', secret: false },
                { key: 'apiKey', label: 'Google Sheets API Key', placeholder: 'AIzaSy...', secret: true },
                { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: '1BxiMVs0...（網址列中間那段）', secret: false },
                { key: 'sheetName', label: '工作表名稱（Sheet Name）', placeholder: '工作表1 或 Sheet1', secret: false },
                { key: 'keyColumn', label: '查詢欄位名稱（標題列的欄名）', placeholder:
                    industry === 'ecommerce' ? '例：訂單編號、商品名稱' :
                    industry === 'restaurant' ? '例：套餐名稱、日期' :
                    industry === 'clinic' ? '例：療程名稱、醫師姓名' :
                    industry === 'beauty' ? '例：服務名稱、設計師姓名' :
                    industry === 'education' ? '例：課程名稱' :
                    '例：訂單編號、房型名稱', secret: false },
              ].map(({ key, label, placeholder, secret }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
                  <input
                    type={secret ? 'password' : 'text'}
                    placeholder={placeholder}
                    value={(editingDsForm as Record<string, unknown>)[key] as string ?? ''}
                    onChange={e => setEditingDsForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              ))}

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">回傳欄位（逗號分隔，留空回傳所有欄位）</label>
                <input
                  type="text"
                  placeholder={
                    industry === 'ecommerce' ? '例：訂單編號,商品名稱,物流單號,配送狀態,預計到貨日' :
                    industry === 'restaurant' ? '例：套餐名稱,內容,價格,適合人數' :
                    industry === 'clinic' ? '例：療程名稱,費用,療程時間,效果持續' :
                    industry === 'beauty' ? '例：服務名稱,短髮價,長髮價,所需時間' :
                    industry === 'education' ? '例：課程名稱,適合年級,月繳,季繳,年繳' :
                    '例：房號,大門密碼,房間密碼'
                  }
                  value={editingDsForm.returnColumns.join(',')}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, returnColumns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <div className="text-[10px] text-gray-400 mt-0.5">依序填入多個欄位，例：房號,大門密碼,房門密碼</div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">觸發方式</label>
                <select
                  value={editingDsForm.triggerMode ?? 'keyword'}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, triggerMode: e.target.value as 'keyword' | 'numeric' | 'both' }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="keyword">關鍵字觸發（客戶訊息含特定詞）</option>
                  <option value="numeric">數字觸發（客戶輸入8位以上訂單號，自動精確比對）</option>
                  <option value="both">兩者皆可</option>
                </select>
                {editingDsForm.triggerMode === 'numeric' && (
                  <div className="text-[10px] text-indigo-600 mt-1 bg-indigo-50 px-2 py-1 rounded">
                    偵測 8 位以上純數字（非 0 開頭、非 + 開頭），精確比對「查詢欄位」後只回覆對應那筆資料。
                  </div>
                )}
              </div>

              {(editingDsForm.triggerMode === 'keyword' || editingDsForm.triggerMode === 'both' || !editingDsForm.triggerMode) && (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">觸發關鍵字（逗號分隔，客戶訊息含此詞才查詢）</label>
                  <input
                    type="text"
                    placeholder="例：訂單,密碼,查詢"
                    value={editingDsForm.triggerKeywords.join(',')}
                    onChange={e => setEditingDsForm(prev => ({ ...prev, triggerKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                <div className="font-medium">如何取得 Spreadsheet ID：</div>
                <div>從 Google Sheets 網址複製：docs.google.com/spreadsheets/d/<strong>【這段】</strong>/edit</div>
                <div className="font-medium mt-1">Google Sheets 需設為「知道連結的人可以查看」，並啟用 Sheets API。</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={saveDs} disabled={savingDs}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                  style={{ background: 'var(--primary)' }}>
                  {savingDs ? '儲存中…' : '儲存'}
                </button>
                <button onClick={() => setEditingDs(null)}
                  className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <div className="font-medium">使用說明</div>
            <div>• 每位使用者可新增多個資料來源，各自填入自己的 Google API Key 與試算表。</div>
            <div>• 「關鍵字觸發」：客戶訊息含觸發詞時，AI 查詢整張表並附上結果。</div>
            <div>• 「數字觸發」：客戶直接輸入 8 位以上訂單號（非 0/+ 開頭）→ 精確比對對應列 → 只回覆那筆的房號、大門密碼、房門密碼等欄位。</div>
            <div>• 回傳欄位可填多個，例：房號,大門密碼,房門密碼，AI 會將所有欄位一併回覆給客戶。</div>
          </div>

          {/* ── 民宿購物設定 ── */}
          <div className="border-t pt-5 space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-700">🍱 民宿購物設定</div>
              <div className="text-xs text-gray-400 mt-0.5">客人透過 LINE AI 點餐後，自動送出到你的 Google Apps Script，再由 Script 推送到 LINE 群組並存入 Sheets（舉例：早餐預訂、備品補充、活動報名）</div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Apps Script Web App 網址 <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="https://script.google.com/macros/s/XXXXX/exec"
                value={breakfastForm.webhookUrl}
                onChange={e => setBreakfastForm(p => ({ ...p, webhookUrl: e.target.value }))}
                className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div className="text-[10px] text-gray-400 mt-0.5">部署 Apps Script 為 Web App 後取得的 /exec 網址</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">截止時間</label>
                <input
                  type="text"
                  placeholder="22:00"
                  value={breakfastForm.cutoffTime}
                  onChange={e => setBreakfastForm(p => ({ ...p, cutoffTime: e.target.value }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">預計送達時間</label>
                <input
                  type="text"
                  placeholder="07:50"
                  value={breakfastForm.deliveryTime}
                  onChange={e => setBreakfastForm(p => ({ ...p, deliveryTime: e.target.value }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 block mb-1">房間列表（每行一間，格式：房號 房型名稱）</label>
              <textarea
                rows={5}
                placeholder={'201 龜山加大床房\n202 蘭博雙人房\n301 海景加大床房\n302 山景雙人房\n401 露臺雙人房'}
                value={breakfastForm.rooms}
                onChange={e => setBreakfastForm(p => ({ ...p, rooms: e.target.value }))}
                className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-500 block mb-1">物品選單（每行一個選項）</label>
              <textarea
                rows={6}
                placeholder={'SET A 薯餅起司堡\nSET B (全素)綜合蔬食總匯\nSET C 厚切牛肉起司堡\nSET D (奶蛋素)松露薯泥堡\nSET E 中華拼盤'}
                value={breakfastForm.menu}
                onChange={e => setBreakfastForm(p => ({ ...p, menu: e.target.value }))}
                className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
              />
              <div className="text-[10px] text-gray-400 mt-0.5">AI 點餐時會直接列出這些選項給客人選擇</div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
              <div className="font-medium">設定完成後 AI 的點餐流程：</div>
              <div>1. 客人說「我要訂早餐」→ AI 說明麥當勞餐券 vs 早餐直送</div>
              <div>2. 客人選擇直送 → AI 確認房號 → 列出上方菜單</div>
              <div>3. 客人選好 → AI 確認訂單 → 客人回「確認」</div>
              <div>4. 系統自動 POST 到 Apps Script → Script 推 LINE 群組 + 存 Sheets</div>
            </div>

            <button
              onClick={saveBreakfast}
              disabled={savingBreakfast || !breakfastForm.webhookUrl.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: 'var(--primary)' }}
            >
              {savingBreakfast
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />儲存中…</>
                : <><CheckCircle2 className="h-3.5 w-3.5" />儲存早餐設定</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Pricing Calculator ─────────────────────────────────────────── */}
      {tab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">定價計算機</div>
              <div className="text-xs text-gray-400 mt-0.5">AI 查詢定價時精確套用數字，不會自行估算</div>
            </div>
            {!editingPc && (
              <div className="flex gap-1.5 flex-wrap">
                {(industry && CS_INDUSTRY_TEMPLATES[industry]
                  ? CS_INDUSTRY_TEMPLATES[industry].pricingButtons
                  : [{ key: 'tour', label: '+ 行程' }, { key: 'accommodation', label: '+ 住宿' }, { key: 'custom', label: '+ 自訂' }]
                ).map(({ key, label }, idx) => (
                  <button key={idx} onClick={() => openAddPc(key)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'var(--primary)' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {pricingConfigs.length === 0 && !editingPc && (
            <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
              <div className="mb-2">尚無定價設定</div>
              <div className="text-xs">選擇上方按鈕新增行程或住宿定價</div>
            </div>
          )}

          {pricingConfigs.length > 0 && !editingPc && (
            <div className="space-y-2">
              {pricingConfigs.map((pc) => {
                const cfg = pc.config as { productType?: string; triggerKeywords?: string[] }
                const typeLabel = cfg.productType === 'tour' ? '行程' : cfg.productType === 'accommodation' ? '住宿' : '自訂'
                return (
                  <div key={pc.id} className="border rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{typeLabel}</span>
                        <span className="truncate">{pc.name}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        觸發詞：{(cfg.triggerKeywords ?? []).join('、') || '（未設定）'}
                      </div>
                    </div>
                    <button onClick={() => togglePc(pc)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pc.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pc.enabled ? '啟用' : '停用'}
                    </button>
                    <button onClick={() => openEditPc(pc)}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">編輯</button>
                    <button onClick={() => deletePc(pc.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">刪除</button>
                  </div>
                )
              })}
            </div>
          )}

          {editingPc !== null && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="font-medium text-sm text-gray-700">{editingPc.id ? '編輯定價設定' : '新增定價設定'}</div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">名稱</label>
                <input
                  type="text"
                  placeholder={
                    industry === 'ecommerce' ? '例：商品定價、運費方案' :
                    industry === 'restaurant' ? '例：套餐定價、包廂費用' :
                    industry === 'clinic' ? '例：療程費用表、套療方案' :
                    industry === 'beauty' ? '例：服務價目表、組合優惠' :
                    industry === 'education' ? '例：學費方案、課程定價' :
                    '例：訂房定價、行程定價'
                  }
                  value={editingPc.name}
                  onChange={e => setEditingPc(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">定價 JSON（直接修改數字即可）</label>
                  <div className="flex gap-1">
                    {(['tour', 'accommodation', 'custom'] as const).map(k => (
                      <button key={k} onClick={() => setEditingPc(prev => prev ? { ...prev, jsonText: JSON.stringify(PRICING_TEMPLATES[k], null, 2) } : prev)}
                        className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                        {k === 'tour' ? '載入行程模板' : k === 'accommodation' ? '載入住宿模板' : '載入自訂模板'}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={editingPc.jsonText}
                  onChange={e => { setEditingPc(prev => prev ? { ...prev, jsonText: e.target.value } : prev); setPcJsonError('') }}
                  rows={18}
                  spellCheck={false}
                  className={`w-full text-xs border rounded-lg px-3 py-2 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 ${pcJsonError ? 'border-red-400' : ''}`}
                />
                {pcJsonError && <div className="text-[10px] text-red-500 mt-1">{pcJsonError}</div>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                <div className="font-medium">JSON 欄位說明</div>
                <div>• <code>triggerKeywords</code>：客戶訊息含這些詞時觸發，例：["賞鯨","行程"]</div>
                <div>• <code>weekdayPrice</code> / <code>weekendPrice</code>：平日 / 假日價格（數字，不含逗號）</div>
                <div>• <code>packages</code>：套餐方案，AI 會優先推薦</div>
                <div>• <code>groupDiscounts</code>：團體折扣規則</div>
                <div>• <code>cancellationPolicy</code>：取消政策說明</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={savePc} disabled={savingPc || !editingPc.name.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                  style={{ background: 'var(--primary)' }}>
                  {savingPc ? '儲存中…' : '儲存'}
                </button>
                <button onClick={() => { setEditingPc(null); setPcJsonError('') }}
                  className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <div className="font-medium">使用說明</div>
            <div>• 日後新增產品：點「+ 自訂」按鈕，填入觸發詞和價格說明即可。</div>
            <div>• AI 收到含觸發詞的訊息時，會自動帶入定價表並逐步計算，不會自行估算。</div>
            <div>• 賞鯨 / 住宿同時設定不會衝突，AI 會根據訊息內容選擇對應的定價表。</div>
          </div>
        </div>
      )}

      {/* ── Tab: Test ───────────────────────────────────────────────────────── */}
      {tab === 'test' && (
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden">
            {/* Chat header */}
            <div className="bg-gray-50 border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-gray-700">客服測試對話</span>
              <span className="text-[10px] text-gray-400">Gemini + Claude 路由</span>

              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {/* 智慧草稿 toggle */}
                <button
                  onClick={() => setDraftMode(v => !v)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    draftMode ? 'bg-violet-50 border-violet-300 text-violet-700 font-medium' : 'border-gray-200 text-gray-400 hover:text-gray-600'
                  }`}>
                  <Wand2 className="h-3 w-3" />
                  草稿模式{draftMode ? '開' : '關'}
                </button>
                {/* 對話摘要 */}
                {testHistory.length > 1 && (
                  <button onClick={summarizeConversation} disabled={summarizing}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-50">
                    {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    摘要
                  </button>
                )}
                {/* 建立工單 */}
                {testHistory.length > 0 && (
                  <button onClick={createTicketFromConversation} disabled={creatingTicket}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-orange-600 hover:border-orange-300 disabled:opacity-50">
                    {creatingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    建立工單
                  </button>
                )}
                {/* 結案 */}
                {testHistory.length > 0 && !caseClosed && (
                  <button onClick={closeCase}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300">
                    <ThumbsUp className="h-3 w-3" />
                    結案
                  </button>
                )}
                {/* 清除 */}
                {testHistory.length > 0 && (
                  <button onClick={() => { setTestHistory([]); setSummary(''); setCaseClosed(false); setDraftText(''); setDraftMeta(null) }}
                    className="text-[10px] text-gray-400 hover:text-gray-600">
                    清除
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
              {testHistory.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-10">
                  在下方輸入框模擬客戶訊息，測試 AI 客服回覆。
                </div>
              )}
              {testHistory.map((msg, i) => {
                const churn = msg.role === 'assistant' && isChurnWarning(msg.meta)
                const isVip = msg.role === 'user' && vipNames.length > 0 && isVipMessage(msg.content)
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* VIP 識別 */}
                      {isVip && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium px-1">
                          <Star className="h-3 w-3" />
                          VIP 客戶 — 優先處理
                        </div>
                      )}
                      {/* 流失預警 */}
                      {churn && (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium px-1">
                          <AlertTriangle className="h-3 w-3" />
                          流失預警：客戶可能考慮取消或離開
                        </div>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'text-white rounded-tr-sm'
                          : churn
                            ? 'bg-red-50 border border-red-200 text-gray-800 rounded-tl-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                        style={msg.role === 'user' ? { background: 'var(--primary)' } : {}}>
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      </div>
                      {msg.role === 'assistant' && msg.meta && (
                        <div className="flex items-center gap-1.5 px-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(msg.meta.risk ?? 'low')}`}>
                            {msg.meta.risk === 'high' ? '高風險' : msg.meta.risk === 'medium' ? '中風險' : '低風險'}
                          </span>
                          <span className="text-[10px] text-gray-400">{msg.meta.intent}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className={`text-[10px] font-medium ${msg.meta.provider === 'Claude' ? 'text-orange-500' : 'text-blue-500'}`}>
                            {msg.meta.provider}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">{draftMode ? 'AI 生成草稿中…' : 'AI 思考中…'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 智慧草稿 panel */}
            {draftMode && draftText && (
              <div className="border-t bg-violet-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">智慧草稿</span>
                  {draftMeta && (
                    <>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(draftMeta.risk ?? 'low')}`}>
                        {draftMeta.risk === 'high' ? '高風險' : draftMeta.risk === 'medium' ? '中風險' : '低風險'}
                      </span>
                      <span className="text-[10px] text-gray-500">{draftMeta.intent}</span>
                    </>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">針對「{draftUserMsg}」的草稿回覆</span>
                </div>
                <textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-violet-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={adoptDraft}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'var(--primary)' }}>
                    採用送出
                  </button>
                  <button onClick={discardDraft}
                    className="px-4 py-1.5 rounded-lg text-xs bg-gray-200 text-gray-600">
                    捨棄
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t px-3 py-2.5 flex gap-2 bg-gray-50">
              <input
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTestMessage() } }}
                placeholder={draftMode ? '輸入客戶訊息… AI 將生成可編輯草稿' : '輸入客戶訊息… (Enter 送出)'}
                className="flex-1 text-sm border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={testLoading}
              />
              <button onClick={sendTestMessage} disabled={testLoading || !testInput.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                送出
              </button>
            </div>
          </div>

          {/* 自動結案倒數 */}
          {caseClosed && autoCloseSecondsLeft !== null && (
            <div className="border border-green-200 rounded-xl bg-green-50 px-4 py-2.5 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">自動結案倒數</span>
              <span className="text-xs text-green-600 ml-auto">
                {Math.floor(autoCloseSecondsLeft / 60)}:{String(autoCloseSecondsLeft % 60).padStart(2, '0')} 後自動關閉工單
              </span>
            </div>
          )}
          {caseClosed && autoCloseSecondsLeft === null && autoCloseMinutes > 0 && (
            <div className="border border-gray-200 rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
              工單已自動結案
            </div>
          )}

          {/* 對話摘要結果 */}
          {summary && (
            <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">對話摘要</span>
                <button onClick={() => setSummary('')} className="ml-auto text-[10px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{summary}</pre>
            </div>
          )}

          {/* Quick test phrases */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-medium">快速測試語句：</div>
            <div className="flex flex-wrap gap-2">
              {(INDUSTRY_TEST_PHRASES[ind] ?? INDUSTRY_TEST_PHRASES.homestay).map(phrase => (
                <button key={phrase} onClick={() => { setTestInput(phrase); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Logs ───────────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {/* ── 客服績效報表 ── */}
          {logs.length > 0 && (() => {
            const total = logs.length
            const highRisk = logs.filter(l => l.risk === 'high').length
            const medRisk = logs.filter(l => l.risk === 'medium').length
            const lowRisk = logs.filter(l => l.risk === 'low').length
            const avgLatency = Math.round(logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0) / total)
            const claudeCount = logs.filter(l => l.provider === 'Claude').length
            const geminiCount = logs.filter(l => l.provider === 'Gemini').length

            // 熱點問題統計
            const intentMap: Record<string, number> = {}
            logs.forEach(l => {
              if (l.intent) intentMap[l.intent] = (intentMap[l.intent] ?? 0) + 1
            })
            const topIntents = Object.entries(intentMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

            return (
              <div className="space-y-3">
                {/* 績效卡片 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{total}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">總對話數</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{avgLatency}<span className="text-xs text-gray-400 ml-0.5">ms</span></div>
                    <div className="text-[10px] text-gray-500 mt-0.5">平均回應速度</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-red-500">{highRisk}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">高風險對話</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-orange-500">{claudeCount}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Claude 升級處理</div>
                  </div>
                </div>

                {/* 風險分佈 */}
                <div className="bg-white border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PieChart className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">風險分佈</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                    {highRisk > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(highRisk/total)*100}%` }} />}
                    {medRisk > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(medRisk/total)*100}%` }} />}
                    {lowRisk > 0 && <div className="bg-green-400 transition-all" style={{ width: `${(lowRisk/total)*100}%` }} />}
                  </div>
                  <div className="flex gap-4 text-[10px] text-gray-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />高風險 {highRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />中風險 {medRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />低風險 {lowRisk}</span>
                    <span className="ml-auto"><span className="text-orange-500 font-medium">Claude</span> {claudeCount} · <span className="text-blue-500 font-medium">Gemini</span> {geminiCount}</span>
                  </div>
                </div>

                {/* 熱點問題統計 */}
                {topIntents.length > 0 && (
                  <div className="bg-white border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">熱點問題 TOP 5</span>
                    </div>
                    <div className="space-y-1.5">
                      {topIntents.map(([intent, count]) => (
                        <div key={intent} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-600 flex-1 truncate">{intent}</span>
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 rounded-full bg-indigo-200" style={{ width: `${Math.max(12, (count/total)*80)}px` }} />
                            <span className="text-[10px] text-gray-400 w-5 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 情緒趨勢圖 */}
                {(() => {
                  // Group logs by date (last 7 days)
                  const dayMap: Record<string, { high: number; medium: number; low: number; total: number }> = {}
                  const now = new Date()
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(now); d.setDate(d.getDate() - i)
                    const key = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                    dayMap[key] = { high: 0, medium: 0, low: 0, total: 0 }
                  }
                  logs.forEach(l => {
                    const key = new Date(l.ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                    if (dayMap[key]) {
                      dayMap[key].total++
                      if (l.risk === 'high') dayMap[key].high++
                      else if (l.risk === 'medium') dayMap[key].medium++
                      else dayMap[key].low++
                    }
                  })
                  const days = Object.entries(dayMap)
                  const maxTotal = Math.max(...days.map(([, v]) => v.total), 1)
                  return (
                    <div className="bg-white border rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-700">情緒趨勢（近 7 天）</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">已上線</span>
                      </div>
                      <div className="flex items-end gap-1.5 h-20">
                        {days.map(([date, v]) => (
                          <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex flex-col justify-end gap-0" style={{ height: '60px' }}>
                              {v.total > 0 ? (
                                <div className="w-full rounded-sm overflow-hidden flex flex-col justify-end gap-px"
                                  style={{ height: `${Math.round((v.total / maxTotal) * 60)}px` }}>
                                  {v.high > 0 && <div className="bg-red-400 w-full" style={{ height: `${Math.round((v.high/v.total)*100)}%`, minHeight: '2px' }} />}
                                  {v.medium > 0 && <div className="bg-amber-400 w-full" style={{ height: `${Math.round((v.medium/v.total)*100)}%`, minHeight: '2px' }} />}
                                  {v.low > 0 && <div className="bg-green-400 w-full" style={{ height: `${Math.round((v.low/v.total)*100)}%`, minHeight: '2px' }} />}
                                </div>
                              ) : (
                                <div className="w-full bg-gray-100 rounded-sm" style={{ height: '4px' }} />
                              )}
                            </div>
                            <span className="text-[9px] text-gray-400">{date}</span>
                            {v.total > 0 && <span className="text-[9px] text-gray-500 font-medium">{v.total}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">對話記錄</span>
            <span className="text-xs text-gray-400">{logs.length} 筆</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">尚無對話記錄</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-1.5 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(log.risk)}`}>
                      {log.risk === 'high' ? '高風險' : log.risk === 'medium' ? '中風險' : '低風險'}
                    </span>
                    <span className="text-[10px] text-gray-500">{log.intent}</span>
                    <span className={`text-[10px] font-medium ${log.provider === 'Claude' ? 'text-orange-500' : 'text-blue-500'}`}>
                      {log.provider}
                    </span>
                    <span className="text-[10px] text-gray-400">{log.latencyMs}ms</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(log.ts).toLocaleString('zh-TW')}</span>
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium text-gray-500">客戶：</span>{log.message}
                  </div>
                  <div className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">
                    <span className="font-medium text-indigo-500">AI：</span>{log.reply.slice(0, 120)}{log.reply.length > 120 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tickets ──────────────────────────────────────────────────────── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">工單系統</span>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                <button key={s} onClick={() => setTicketFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    ticketFilter === s ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={ticketFilter === s ? { background: 'var(--primary)' } : {}}>
                  {s === 'all' ? '全部' : ticketStatusLabel(s)}
                  {s !== 'all' && ` (${tickets.filter(t => t.status === s).length})`}
                </button>
              ))}
              <button onClick={loadTickets} disabled={ticketsLoading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                {ticketsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            切換到「測試」Tab，與 AI 對話後點「建立工單」即可轉入工單系統
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">尚無工單</div>
          ) : (
            <div className="space-y-2">
              {tickets
                .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                .map(ticket => (
                  <div key={ticket.id} className="border rounded-xl p-3 bg-white space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ticketStatusColor(ticket.status)}`}>
                        {ticketStatusLabel(ticket.status)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ticketPriorityColor(ticket.priority)}`}>
                        {ticketPriorityLabel(ticket.priority)}優先
                      </span>
                      <span className="text-[10px] text-gray-500">{platformEmoji(ticket.platform)} {ticket.platform}</span>
                      {ticket.intent && <span className="text-[10px] text-gray-400">{ticket.intent}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString('zh-TW')}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-800">{ticket.subject}</div>
                    <div className="text-[11px] text-gray-500 line-clamp-2">{ticket.description.slice(0, 120)}{ticket.description.length > 120 ? '…' : ''}</div>
                    <div className="flex gap-1.5 pt-1 flex-wrap">
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).filter(s => s !== ticket.status).map(s => (
                        <button key={s} onClick={async () => {
                          const res = await fetch(`/api/marketing/cs-tickets/${ticket.id}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: s }),
                          })
                          const d = await res.json()
                          if (d.ticket) setTickets(prev => prev.map(t => t.id === ticket.id ? d.ticket : t))
                        }}
                          className="text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          → {ticketStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Inbox ────────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">統一收件匣</span>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', 'line', 'whatsapp', 'telegram', 'test'].map(p => (
                <button key={p} onClick={() => { setInboxPlatformFilter(p); }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    inboxPlatformFilter === p ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={inboxPlatformFilter === p ? { background: 'var(--primary)' } : {}}>
                  {p === 'all' ? '全部' : `${platformEmoji(p)} ${p.toUpperCase()}`}
                </button>
              ))}
              <button onClick={loadInbox} disabled={inboxLoading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                {inboxLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
            <div className="font-medium">來源說明</div>
            <div>• 🧪 測試：透過「測試」Tab 的對話自動儲存</div>
            <div>• 💬 LINE / 📱 WhatsApp / ✈️ Telegram：實際平台 Webhook 訊息（需先在「平台」Tab 設定）</div>
          </div>

          {inboxLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : inboxMessages.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">
              <div className="mb-2">尚無訊息記錄</div>
              <div className="text-[11px]">先在「測試」Tab 發送幾則訊息，即可在此查看</div>
            </div>
          ) : (
            <div className="space-y-2">
              {inboxMessages
                .filter(m => inboxPlatformFilter === 'all' || m.platform === inboxPlatformFilter)
                .map(msg => (
                  <div key={msg.id} className="border rounded-xl p-3 bg-white space-y-1.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-700">
                        {platformEmoji(msg.platform)} {msg.from_name ?? msg.from_id}
                      </span>
                      {msg.risk && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(msg.risk)}`}>
                          {msg.risk === 'high' ? '高風險' : msg.risk === 'medium' ? '中風險' : '低風險'}
                        </span>
                      )}
                      {msg.intent && <span className="text-[10px] text-gray-400">{msg.intent}</span>}
                      {msg.latency_ms && <span className="text-[10px] text-gray-300">{msg.latency_ms}ms</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(msg.created_at).toLocaleString('zh-TW')}</span>
                    </div>
                    <div className="text-xs text-gray-700">
                      <span className="font-medium text-gray-500">客戶：</span>{msg.message}
                    </div>
                    {msg.reply && (
                      <div className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">
                        <span className="font-medium text-indigo-500">AI：</span>{msg.reply.slice(0, 120)}{msg.reply.length > 120 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoon({ unit }: { unit: UnitDef }) {
  const Icon = unit.icon
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
        <Icon className="h-8 w-8" style={{ color: 'var(--primary)' }} />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">{unit.name}</h3>
      <p className="text-sm text-gray-500 mb-4">{unit.desc}</p>
      <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
        建設中，敬請期待
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingAutoPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignTitle, setCampaignTitle] = useState('未命名行銷專案')
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [creating, setCreating] = useState(false)
  const [campaignMenu, setCampaignMenu] = useState<string | null>(null) // campaign id with open "..." menu
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [csMode, setCsMode] = useState<boolean | null>(null)
  const [csIndustry, setCsIndustry] = useState<string | null>(null)
  const [activeUnit, setActiveUnit] = useState(1)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const isCs = p.get('module') === 'cs'
    setCsMode(isCs)
    if (isCs) {
      setActiveUnit(12)
      const ind = p.get('industry')
      if (ind) setCsIndustry(ind)
    }
  }, [])
  const [unitStatuses, setUnitStatuses] = useState<Record<number, UnitStatus>>({})
  const [unitData, setUnitData] = useState<Record<number, unknown>>({})

  // Drive folders — per unit (5, 6, 7), persisted per campaign as drive_folders JSON map
  const [driveFolders, setDriveFolders] = useState<Record<number, { id: string; name: string }>>({})
  const [driveImages, setDriveImages] = useState<Record<number, DrivePickedImage | null>>({})

  // Shared company data (Unit 2) — global, not per campaign
  const [companyData, setCompanyData] = useState<Unit2Data>({})

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
      .then(d => { if (d.data) setCompanyData(d.data) })
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
  // CS mode: each industry gets its own isolated campaign
  useEffect(() => {
    if (csMode === null) return // wait for URL detection
    const run = async () => {
      // CS mode: use industry-specific storage key to isolate configs
      const storageKey = (csMode && csIndustry)
        ? `aigate_cs_campaign_${csIndustry}`
        : 'aigate_last_campaign'

      const savedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null

      if (savedId) {
        // Try to load the saved campaign for this industry
        try {
          const r = await fetch(`/api/marketing/campaign/${savedId}`)
          if (r.ok) {
            const c = (await r.json()).campaign
            if (c) {
              setCampaignId(c.id)
              setCampaignTitle(c.title ?? '未命名行銷專案')
              setUnitStatuses(c.unit_statuses ?? {})
              setUnitData(c.unit_data ?? {})
              return
            }
          }
        } catch { /* ignore, fall through */ }
      }

      // No saved campaign for this industry — load list and pick appropriately
      const list = await loadCampaigns()
      if (!list?.length) return

      if (csMode && csIndustry) {
        // In CS mode: don't auto-load a random campaign; start fresh for this industry
        return
      }

      // Normal marketing mode: restore last used
      const lastId = list[0].id
      try {
        const r = await fetch(`/api/marketing/campaign/${lastId}`)
        if (!r.ok) return
        const c = (await r.json()).campaign
        if (!c) return
        setCampaignId(c.id)
        setCampaignTitle(c.title ?? '未命名行銷專案')
        setUnitStatuses(c.unit_statuses ?? {})
        setUnitData(c.unit_data ?? {})
        if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', c.id)
      } catch { /* ignore */ }
    }
    run()
  }, [loadCampaigns, csMode, csIndustry])

  const createCampaign = useCallback(async (): Promise<string | null> => {
    setCreating(true)
    // In CS mode, auto-name by industry and tag with industry field
    const isCs = csMode && csIndustry
    const industryLabel = csIndustry ? (CS_INDUSTRY_TEMPLATES[csIndustry]?.label ?? csIndustry) : ''
    const title = isCs ? `${industryLabel} 客服設定` : campaignTitle
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, ...(isCs ? { industry: csIndustry } : {}) }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.id) {
      setCampaignId(data.id)
      if (isCs) {
        setCampaignTitle(title)
        if (typeof window !== 'undefined') localStorage.setItem(`aigate_cs_campaign_${csIndustry}`, data.id)
      } else {
        loadCampaigns()
        if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', data.id)
      }
      return data.id as string
    }
    return null
  }, [campaignTitle, csMode, csIndustry, loadCampaigns])

  const loadCampaign = async (id: string) => {
    const res = await fetch(`/api/marketing/campaign/${id}`)
    if (!res.ok) return
    const c = (await res.json()).campaign
    setCampaignId(c.id)
    setCampaignTitle(c.title ?? '未命名行銷專案')
    setUnitStatuses(c.unit_statuses ?? {})
    setUnitData(c.unit_data ?? {})
    setDriveFolders(c.drive_folders ?? {})
    setDriveImages({})
    setShowCampaigns(false)
    const storageKey = (csMode && csIndustry) ? `aigate_cs_campaign_${csIndustry}` : 'aigate_last_campaign'
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, id)
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

  const handleUnit12Done = useCallback(async (data: Unit12Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(12, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const handleDriveFolderChange = useCallback(async (unitId: number, id: string, name: string) => {
    const next = { ...driveFolders, [unitId]: { id, name } }
    setDriveFolders(next)
    const cid = await ensureCampaign()
    if (cid) await patchCampaign(cid, { drive_folders: next })
  }, [ensureCampaign, driveFolders])

  const currentUnit = UNITS.find(u => u.id === activeUnit) ?? SIDE_TOOLS.find(t => t.id === activeUnit) ?? UNITS[0]

  // CS-only mode: no sidebar, full-width customer service
  // null = still detecting (avoid SSR flash), true = cs mode, false = full page
  if (csMode === null) return <div className="h-[calc(100vh-53px)] bg-white" />
  if (csMode) {
    return (
      <div className="h-[calc(100vh-53px)] overflow-y-auto bg-white">
        <Unit12CustomerService
          campaignId={campaignId}
          savedData={unitData[12] as Unit12Data | undefined}
          unit2Data={companyData}
          industry={csIndustry ?? undefined}
          onDone={handleUnit12Done}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-53px)] overflow-hidden">

      {/* Left nav */}
      <aside className="w-56 shrink-0 border-r bg-gray-50 flex flex-col select-none">
        {/* Campaign selector */}
        <div className="p-3 border-b space-y-2">
          <div className="relative" ref={dropRef}>
            <button onClick={() => setShowCampaigns(!showCampaigns)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-left hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{campaignTitle}</div>
                <div className="text-[10px] text-gray-400">{campaignId ? '已儲存' : '尚未建立'}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            </button>

            {showCampaigns && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                <button onClick={() => { setCampaignId(null); setCampaignTitle('未命名行銷專案'); setUnitStatuses({}); setUnitData({}); setShowCampaigns(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-left border-b"
                  style={{ color: 'var(--primary)' }}>
                  <Plus className="h-3.5 w-3.5" /> 新建專案
                </button>
                {campaigns.map(c => (
                  <div key={c.id} className={`relative flex items-center group ${c.id === campaignId ? 'bg-gray-50 font-medium' : ''}`}>
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
                        className="flex-1 flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-50 text-left">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{c.title}</div>
                          <div className="text-gray-400 text-[10px]">{new Date(c.updated_at).toLocaleDateString('zh-TW')}</div>
                        </div>
                        {c.id === campaignId && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                      </button>
                    )}
                    {/* "..." menu */}
                    {renamingId !== c.id && (
                      <div className="relative flex-shrink-0 pr-1">
                        <button
                          onClick={e => { e.stopPropagation(); setCampaignMenu(campaignMenu === c.id ? null : c.id) }}
                          className="p-1 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {campaignMenu === c.id && (
                          <div className="absolute right-0 top-full mt-0.5 w-24 bg-white border rounded-lg shadow-lg z-50 overflow-hidden text-xs">
                            <button onClick={() => { setRenamingId(c.id); setRenameValue(c.title); setCampaignMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                              <Pencil className="h-3 w-3" /> 更名
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`確定刪除「${c.title}」？`)) return
                              await fetch(`/api/marketing/campaign/${c.id}`, { method: 'DELETE' })
                              if (c.id === campaignId) { setCampaignId(null); setCampaignTitle('未命名行銷專案'); setUnitStatuses({}); setUnitData({}) }
                              setCampaigns(prev => prev.filter(x => x.id !== c.id))
                              setCampaignMenu(null)
                            }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 text-left">
                              <Trash2 className="h-3 w-3" /> 刪除
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {campaigns.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">尚無專案</div>}
              </div>
            )}
          </div>

          <input value={campaignTitle} onChange={e => setCampaignTitle(e.target.value)}
            onBlur={() => { if (campaignId) patchCampaign(campaignId, { title: campaignTitle }) }}
            className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-1 bg-white"
            placeholder="專案名稱…" />

          {!campaignId && (
            <button onClick={createCampaign} disabled={creating}
              className="w-full flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {creating ? '建立中…' : '建立專案'}
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
                  <div className="text-xs font-medium truncate">{unit.name}</div>
                  {!unit.implemented && <div className="text-[10px] text-gray-400">建設中</div>}
                </div>
                {status === 'done'    && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                {status === 'running' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />}
                {status === 'error'   && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <div className="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wide">其他工具</div>
          <a href={campaignId ? `/marketing-pipeline?campaign=${campaignId}` : '/marketing-pipeline'}
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-amber-600 hover:bg-amber-50">
            <Zap className="h-3.5 w-3.5" /> 自動化流程
            {campaignId && <span className="ml-auto text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">串接中</span>}
          </a>
          {SIDE_TOOLS.map(tool => {
            const Icon = tool.icon
            const isActive = activeUnit === tool.id
            return tool.href ? (
              <a key={tool.id} href={tool.href}
                className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-blue-600 hover:bg-blue-50">
                <Icon className="h-3.5 w-3.5" /> {tool.name}
              </a>
            ) : (
              <button key={tool.id} onClick={() => setActiveUnit(tool.id)}
                className={`w-full flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-left ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-blue-600 hover:bg-blue-50'
                }`}>
                <Icon className="h-3.5 w-3.5" /> {tool.name}
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t">
          <a href="/settings"
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <Settings className="h-3.5 w-3.5" /> 平台連結設定
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
            <h1 className="font-bold text-base text-gray-900">{UNITS.find(u => u.id === activeUnit) ? `${currentUnit.id}. ` : ''}{currentUnit.name}</h1>
            <p className="text-xs text-gray-400">{currentUnit.desc}</p>
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
          {activeUnit === 2 && (
            <Unit2CompanyData
              campaignId={campaignId}
              savedData={companyData}
              onSave={handleUnit2Save}
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
          {activeUnit === 6 && (
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
          {activeUnit === 8 && (
            <Unit8VideoGenerate
              campaignId={campaignId}
              savedData={unitData[8] as Unit8Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              unit7Data={unitData[7] as Unit7Data | undefined}
              drivePickedImage={driveImages[7] ?? driveImages[5] ?? null}
              onDone={handleUnit8Done}
            />
          )}
          {activeUnit === 9 && (
            <Unit9Upload
              campaignId={campaignId}
              savedData={unitData[9] as Unit9Data | undefined}
              unit4Data={unitData[4] as Unit4Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              unit8Data={unitData[8] as Unit8Data | undefined}
              onDone={handleUnit9Done}
            />
          )}
          {activeUnit === 10 && (
            <Unit10ProspectMarketing
              campaignId={campaignId}
              savedData={unitData[10] as Unit10Data | undefined}
              unit2Data={companyData}
              unit4Data={unitData[4] as Unit4Data | undefined}
              onDone={handleUnit10Done}
            />
          )}
          {activeUnit === 11 && (
            <Unit11AvatarMarketing
              campaignId={campaignId}
              savedData={unitData[11] as Unit11Data | undefined}
              unit2Data={companyData}
              unit4Data={unitData[4] as Unit4Data | undefined}
              onDone={handleUnit11Done}
            />
          )}
          {activeUnit === 12 && (
            <Unit12CustomerService
              campaignId={campaignId}
              savedData={unitData[12] as Unit12Data | undefined}
              unit2Data={companyData}
              industry={csIndustry ?? undefined}
              onDone={handleUnit12Done}
            />
          )}
          {activeUnit !== 1 && activeUnit !== 2 && activeUnit !== 3 && activeUnit !== 4 && activeUnit !== 5 && activeUnit !== 6 && activeUnit !== 7 && activeUnit !== 8 && activeUnit !== 9 && activeUnit !== 10 && activeUnit !== 11 && activeUnit !== 12 && <ComingSoon unit={currentUnit} />}
        </div>
      </main>
    </div>
  )
}
