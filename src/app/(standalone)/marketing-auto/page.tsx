'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Plus, ChevronDown, Loader2, CheckCircle2, AlertCircle,
  XCircle, RefreshCw, Globe, Map, Star, Target, Newspaper, Settings,
  FileText, X, Download, Sparkles, Wand2, Volume2, PhoneCall, PhoneOff, Zap,
  Bell, ShoppingBag, Smartphone, TrendingUp,
  MoreHorizontal, Pencil, Trash2, Check
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  { id: 10, name: '電話行銷',  icon: Phone,      desc: 'VBEE / ElevenLabs + Plivo',   implemented: true  },
  { id: 11, name: '主播行銷',  icon: Mic,        desc: 'HeyGen 虛擬主播影片',          implemented: true  },
  { id: 12, name: '客服系統',  icon: Headphones, desc: 'LINE/WhatsApp/Zalo 智能客服',  implemented: true  },
]

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
      { id: 'videos',   label: '影音搜尋' },
      { id: 'comments', label: '評論' },
    ],
  },
  {
    id: 'facebook', label: 'Facebook', emoji: '👥',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',    label: '內文' },
      { id: 'comments', label: '評論' },
    ],
  },
  {
    id: 'instagram', label: 'Instagram', emoji: '📸',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',    label: '內文' },
      { id: 'comments', label: '評論' },
    ],
  },
  {
    id: 'threads', label: 'Threads', emoji: '🧵',
    desc: '內文 / 評論',
    subOptions: [
      { id: 'posts',    label: '內文' },
      { id: 'comments', label: '評論' },
    ],
  },
  {
    id: 'youtube', label: 'YouTube', emoji: '🎬',
    desc: '短影音 / 長影音 / 評論',
    subOptions: [
      { id: 'shorts',   label: '短影音' },
      { id: 'videos',   label: '長影音' },
      { id: 'comments', label: '評論' },
    ],
  },
  {
    id: 'amazon', label: 'Amazon', emoji: '📦',
    desc: '產品 / 評論',
    subOptions: [
      { id: 'products', label: '產品' },
      { id: 'reviews',  label: '評論' },
    ],
  },
  {
    id: 'shopee', label: 'Shopee', emoji: '🛒',
    desc: '產品 / 評論 (可選國家)',
    needsCountry: true,
    subOptions: [
      { id: 'products', label: '產品' },
      { id: 'reviews',  label: '評論' },
    ],
  },
  {
    id: 'ios_android', label: 'iOS / Android', emoji: '📲',
    desc: 'App Store / Google Play 評論',
    needsAppIds: true,
    subOptions: [
      { id: 'reviews', label: '評論' },
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
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const set = (key: keyof Unit2Data, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

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
    const data: Unit2Data = { ...form, files }
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
      {(form.companyName || files.length > 0) && (
        <div className="p-4 rounded-xl bg-gray-50 border">
          <div className="text-xs font-medium text-gray-500 mb-3">資料概覽</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '公司名稱', value: form.companyName || '—' },
              { label: '產業', value: form.industry || '—' },
              { label: '品牌語調', value: form.brandTone || '—' },
              { label: '員工人數', value: form.employees || '—' },
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

interface Unit4Data {
  types?: CopyType[]
  results?: Record<string, string>
  userInstructions?: string
  feedback?: string
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

  useEffect(() => {
    if (result?.types?.length && !activeTab) setActiveTab(result.types[0])
  }, [result, activeTab])

  const toggleType = (t: CopyType) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const run = async (fb?: string) => {
    if (selectedTypes.length === 0) { setError('請至少選一種文案類型'); return }
    setRunning(true); setError('')
    try {
      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: selectedTypes,
          userInstructions: instructions,
          companyData: unit2Data ?? {},
          analysisData: unit3Data ?? {},
          collectedSummary: unit1Data?.summary ?? '',
          feedback: fb ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit4Data = {
        types: selectedTypes,
        results: data.results,
        userInstructions: instructions,
      }
      setResult(out)
      setEditedCopy(data.results ?? {})
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
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit5Data
  unit1Data?: { summary?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  unit4Data?: Unit4Data
  onDone: (data: Unit5Data) => void
}) {
  const [count, setCount] = useState(savedData?.count ?? 3)
  const [platforms, setPlatforms] = useState<string[]>(
    savedData?.platforms ?? ['facebook_post', 'instagram_caption']
  )
  const [instructions, setInstructions] = useState(savedData?.userInstructions ?? '')
  const [feedback, setFeedback] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit5Data | null>(savedData?.scripts?.length ? savedData : null)
  const [activeScript, setActiveScript] = useState(1)

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const run = async (fb?: string) => {
    setRunning(true); setError('')
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

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button onClick={() => run()} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running
          ? <><Loader2 className="h-4 w-4 animate-spin" />Claude 生成腳本中…</>
          : <><ImageIcon className="h-4 w-4" />產生圖片腳本</>}
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
  const patterns = [
    /AI\s*生成\s*Prompt[：:]\s*(.+?)(?:\n|$)/i,
    /Prompt[：:]\s*(.+?)(?:\n|$)/i,
  ]
  for (const re of patterns) {
    const m = content.match(re)
    if (m) return m[1].trim()
  }
  return ''
}

function Unit6ImageGenerate({
  campaignId: _campaignId,
  savedData,
  unit5Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit6Data
  unit5Data?: Unit5Data
  onDone: (data: Unit6Data) => void
}) {
  const scripts = unit5Data?.scripts ?? []

  const [model, setModel] = useState<ImageModel>('flux')
  const [size, setSize] = useState('1:1')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid')
  const [prompts, setPrompts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    scripts.forEach(s => { init[s.id] = extractPrompt(s.content) })
    return init
  })
  const [generating, setGenerating] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [images, setImages] = useState<GeneratedImage[]>(savedData?.images ?? [])
  const [manualPrompt, setManualPrompt] = useState('')
  const [manualGenerating, setManualGenerating] = useState(false)
  const [manualError, setManualError] = useState('')

  const hasUnit5 = scripts.length > 0

  const buildPayload = (prompt: string, scriptId: number) => ({
    prompt, scriptId, model, size, quality, style,
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
                      onChange={e => setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))}
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
  { value: '8',   label: '8秒',  hint: '超短影音' },
  { value: '15',  label: '15秒', hint: 'Reels/Shorts' },
  { value: '30',  label: '30秒', hint: '廣告/短影音' },
  { value: '60',  label: '60秒', hint: 'IG/TikTok' },
  { value: '90',  label: '90秒', hint: '教學/介紹' },
  { value: '120', label: '2分鐘', hint: 'YouTube' },
]

function Unit7VideoScript({
  campaignId: _campaignId,
  savedData,
  unit1Data,
  unit2Data,
  unit3Data,
  unit4Data,
  unit5Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit7Data
  unit1Data?: { summary?: string }
  unit2Data?: Unit2Data
  unit3Data?: Unit3Data
  unit4Data?: Unit4Data
  unit5Data?: Unit5Data
  onDone: (data: Unit7Data) => void
}) {
  const [count, setCount] = useState(savedData?.count ?? 1)
  const [duration, setDuration] = useState(savedData?.duration ?? '30')
  const [videoTypes, setVideoTypes] = useState<string[]>(savedData?.videoTypes ?? ['short_video'])
  const [platforms, setPlatforms] = useState<string[]>(savedData?.platforms ?? ['instagram_reels', 'tiktok'])
  const [instructions, setInstructions] = useState(savedData?.userInstructions ?? '')
  const [feedback, setFeedback] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit7Data | null>(savedData?.scripts?.length ? savedData : null)
  const [activeScript, setActiveScript] = useState(1)

  const toggleType = (id: string) =>
    setVideoTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const togglePlatform = (id: string) =>
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const run = async (fb?: string) => {
    if (videoTypes.length === 0) { setError('請至少選一種影片類型'); return }
    if (platforms.length === 0) { setError('請至少選一個平台'); return }
    setRunning(true); setError('')
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

      <button onClick={() => run()} disabled={running}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'var(--primary)' }}>
        {running
          ? <><Loader2 className="h-4 w-4 animate-spin" />Claude 生成腳本中…</>
          : <><Film className="h-4 w-4" />產生影片腳本</>}
      </button>

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
              腳本完成後，前往 <strong>單元8 影片產出</strong> 使用 KLING 或 VEO3 將腳本轉換為實際影片。
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit 8: 影片產出 ─────────────────────────────────────────────────────────

type VideoModel = 'kling-standard' | 'kling-pro' | 'kling-img2video'

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

const VIDEO_MODELS: { id: VideoModel; name: string; desc: string; badge: string }[] = [
  { id: 'kling-standard',  name: 'KLING Standard', desc: '文字生成影片，標準品質，速度較快', badge: '推薦' },
  { id: 'kling-pro',       name: 'KLING Pro',      desc: '文字生成影片，旗艦品質',          badge: 'Pro'  },
  { id: 'kling-img2video', name: 'KLING 圖生影片', desc: '從單元6圖片生成動態影片',         badge: '圖轉影' },
]

const VIDEO_ASPECT_OPTIONS = [
  { value: '16:9', label: '16:9 橫式', hint: 'YouTube/FB' },
  { value: '9:16', label: '9:16 直式', hint: 'Reels/TikTok' },
  { value: '1:1',  label: '1:1 正方形', hint: 'IG/通用' },
]

// Extract first prompt line from video script
function extractVideoPrompt(content: string): string {
  const m = content.match(/開頭\s*Hook.*?畫面[：:]\s*(.+?)(?:\n|$)/i)
    ?? content.match(/畫面[：:]\s*(.+?)(?:\n|$)/i)
    ?? content.match(/影片標題[：:]\s*(.+?)(?:\n|$)/i)
  if (m) return m[1].trim()
  // fallback: first non-empty line
  return content.split('\n').find(l => l.trim().length > 10)?.trim() ?? content.slice(0, 150)
}

function Unit8VideoGenerate({
  campaignId: _campaignId,
  savedData,
  unit6Data,
  unit7Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit8Data
  unit6Data?: Unit6Data
  unit7Data?: Unit7Data
  onDone: (data: Unit8Data) => void
}) {
  const scripts = unit7Data?.scripts ?? []
  const generatedImages = unit6Data?.images ?? []

  const [model, setModel] = useState<VideoModel>('kling-standard')
  const [duration, setDuration] = useState<'5' | '10'>('5')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [prompts, setPrompts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    scripts.forEach(s => { init[s.id] = extractVideoPrompt(s.content) })
    return init
  })
  const [selectedImage, setSelectedImage] = useState<string>('')
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

  const submitJob = async (scriptId: number) => {
    const prompt = prompts[scriptId]?.trim()
    if (!prompt) return
    const payload: Record<string, unknown> = { prompt, scriptId, model, duration, aspectRatio }
    if (model === 'kling-img2video' && selectedImage) payload.imageUrl = selectedImage

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
    if (model === 'kling-img2video' && selectedImage) payload.imageUrl = selectedImage
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

      {/* Model selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">選擇生成模型</label>
        <div className="grid grid-cols-3 gap-3">
          {VIDEO_MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)}
              className="relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all"
              style={model === m.id
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                : { borderColor: '#e5e7eb', background: 'white' }}>
              <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={model === m.id ? { background: 'var(--primary)', color: 'white' } : { background: '#f3f4f6', color: '#6b7280' }}>
                {m.badge}
              </span>
              <span className="text-sm font-bold text-gray-800 pr-8">{m.name}</span>
              <span className="text-[10px] text-gray-400 mt-1 leading-snug">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 rounded-xl bg-gray-50 border space-y-4">
        <div className="text-xs font-semibold text-gray-600">影片設定</div>
        <div className="flex flex-wrap gap-6">
          {/* Duration */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">影片時長</div>
            <div className="flex gap-2">
              {(['5', '10'] as const).map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className="px-4 py-2 rounded-lg border text-xs font-medium transition-all"
                  style={duration === d
                    ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                    : { background: 'white' }}>
                  {d} 秒
                </button>
              ))}
            </div>
          </div>
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
      {model === 'kling-img2video' && (
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 space-y-2">
          <div className="text-xs font-semibold text-blue-800">選擇來源圖片（單元6 已生成）</div>
          {hasUnit6Images ? (
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
            <p className="text-xs text-blue-600">尚未在單元6生成圖片。請先完成單元6，或使用文字生成影片模式。</p>
          )}
          {selectedImage && (
            <p className="text-[10px] text-blue-500">已選擇圖片，將以此圖生成動態影片</p>
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
                    <textarea value={prompts[s.id] ?? ''} onChange={e => setPrompts(prev => ({ ...prev, [s.id]: e.target.value }))}
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
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />KLING 生成中…</>
                      : <><Sparkles className="h-3.5 w-3.5" />{vid ? '重新生成' : '生成影片'}</>}
                  </button>
                  {vid && (
                    <div className="rounded-xl overflow-hidden border bg-black">
                      <video src={vid.url} controls className="w-full max-h-72" />
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t">
                        <span className="text-[10px] text-gray-400 flex-1">{VIDEO_MODELS.find(m => m.id === vid.model)?.name} · {new Date(vid.generatedAt).toLocaleString('zh-TW')}</span>
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
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />KLING 生成中…</>
            : <><Sparkles className="h-3.5 w-3.5" />生成影片</>}
        </button>
        {(() => {
          const manualVid = videos.find(v => v.scriptId === 0)
          return manualVid ? (
            <div className="rounded-xl overflow-hidden border bg-black mt-3">
              <video src={manualVid.url} controls autoPlay className="w-full max-h-72" />
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t">
                <span className="text-[10px] text-gray-400 flex-1">
                  {VIDEO_MODELS.find(m => m.id === manualVid.model)?.name} · {new Date(manualVid.generatedAt).toLocaleString('zh-TW')}
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
                  {r.error && <div className="text-xs text-red-600 mt-0.5">{r.error}</div>}
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

// ─── Unit 10: 電話行銷 ────────────────────────────────────────────────────────

interface CallRecord {
  phone: string
  ok: boolean
  id?: string
  error?: string
}

interface Unit10Data {
  lastBatch?: {
    total: number
    success: number
    results: CallRecord[]
    audioUrl?: string
    calledAt: string
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

function Unit10PhoneMarketing({
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
  const [script, setScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptLang, setScriptLang] = useState('繁體中文')

  const [voiceId, setVoiceId] = useState('EXAVITQu4vr4xnSDxMaL')
  const [birdCallerId, setBirdCallerId] = useState('')

  const [phoneInput, setPhoneInput] = useState('')
  const [phones, setPhones] = useState<string[]>([])

  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')

  const [calling, setCalling] = useState(false)
  const [callError, setCallError] = useState('')
  const [results, setResults] = useState<CallRecord[]>(savedData?.lastBatch?.results ?? [])

  const parsePhones = (raw: string): string[] =>
    raw.split(/[\n,;，；\s]+/).map(p => p.trim()).filter(p => p.length >= 8)

  const handlePhoneInput = (val: string) => {
    setPhoneInput(val)
    setPhones(parsePhones(val))
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
    <div className="space-y-6">

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
  const [script, setScript] = useState('')
  const [ratio, setRatio] = useState('16:9')
  const [background, setBackground] = useState('#FFFFFF')
  const [customBg, setCustomBg] = useState('')

  // Script AI gen
  const [genCount, setGenCount] = useState(1)
  const [genDuration, setGenDuration] = useState(60)
  const [genStyle, setGenStyle] = useState('專業親切')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptOptions, setScriptOptions] = useState<string[]>([])

  // Video submission / polling
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [videos, setVideos] = useState<AvatarVideo[]>(savedData?.videos ?? [])
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // ── Load avatars & voices ──────────────────────────────────────────────────
  async function loadAssets() {
    setLoadingAssets(true)
    try {
      const [avatarRes, voiceRes] = await Promise.all([
        fetch('/api/marketing/heygen-avatar?type=avatars'),
        fetch('/api/marketing/heygen-avatar?type=voices'),
      ])
      const [avatarJson, voiceJson] = await Promise.all([avatarRes.json(), voiceRes.json()])
      setAvatars(avatarJson.avatars ?? [])
      setVoices(voiceJson.voices ?? [])
      setAssetsLoaded(true)
    } catch (e) {
      console.error(e)
    }
    setLoadingAssets(false)
  }

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
          setVideos(prev => {
            const updated = prev.map(v =>
              v.videoId === videoId
                ? { ...v, status: data.status, videoUrl: data.videoUrl ?? v.videoUrl }
                : v
            )
            onDone({ videos: updated })
            return updated
          })
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

  // ── AI generate script ────────────────────────────────────────────────────
  async function generateScript() {
    if (!campaignId) { setSubmitError('請先建立活動'); return }
    setGeneratingScript(true)
    setScriptOptions([])
    try {
      const res = await fetch('/api/marketing/avatar-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, count: genCount, duration: genDuration, style: genStyle }),
      })
      const data = await res.json()
      if (data.scripts?.length) {
        setScriptOptions(data.scripts)
        setScript(data.scripts[0])
      } else {
        setSubmitError(data.error ?? 'AI 生成失敗')
      }
    } catch (e) {
      setSubmitError(String(e))
    }
    setGeneratingScript(false)
  }

  // ── Submit video generation ───────────────────────────────────────────────
  async function submitVideo() {
    if (!selectedAvatar) { setSubmitError('請選擇主播 Avatar'); return }
    if (!selectedVoice)  { setSubmitError('請選擇聲音'); return }
    if (!script.trim())  { setSubmitError('請輸入腳本'); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/marketing/heygen-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: selectedAvatar.id,
          voiceId: selectedVoice.id,
          script,
          ratio,
          background: customBg || background,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? '提交失敗'); return }

      const newVideo: AvatarVideo = {
        videoId: data.videoId,
        script: script.slice(0, 80) + (script.length > 80 ? '…' : ''),
        avatarName: selectedAvatar.name,
        voiceName: selectedVoice.name,
        ratio,
        status: 'processing',
        createdAt: new Date().toISOString(),
      }
      const updated = [newVideo, ...videos]
      setVideos(updated)
      onDone({ videos: updated })
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

      {/* Step 1: Load avatars */}
      {!assetsLoaded ? (
        <div className="border rounded-xl p-5 space-y-3 bg-indigo-50 border-indigo-200">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-indigo-600" />
            <span className="font-medium text-indigo-800 text-sm">載入 HeyGen 主播資源</span>
          </div>
          <p className="text-xs text-indigo-600">點擊下方按鈕從 HeyGen 載入可用的 Avatar 主播與聲音清單。</p>
          {loadingAssets
            ? <div className="flex items-center gap-2 text-sm text-indigo-600"><Loader2 className="h-4 w-4 animate-spin" />載入中…</div>
            : <button onClick={loadAssets}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--primary)' }}>
                載入主播 &amp; 聲音清單
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

          {/* Right: Script panel */}
          <div className="space-y-4">
            {/* AI script generator */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm text-gray-700">AI 腳本生成</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">份數</label>
                  <input type="number" min={1} max={5} value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">時長（秒）</label>
                  <input type="number" min={15} max={300} step={15} value={genDuration}
                    onChange={e => setGenDuration(Number(e.target.value))}
                    className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">風格</label>
                  <select value={genStyle} onChange={e => setGenStyle(e.target.value)}
                    className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option>專業親切</option>
                    <option>熱情活力</option>
                    <option>沉穩信任</option>
                    <option>輕鬆幽默</option>
                    <option>商務正式</option>
                  </select>
                </div>
              </div>
              <button onClick={generateScript} disabled={generatingScript || !campaignId}
                className="w-full py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                {generatingScript ? <><Loader2 className="h-4 w-4 animate-spin" />AI 生成中…</> : <><Wand2 className="h-4 w-4" />AI 生成腳本</>}
              </button>

              {/* Script options */}
              {scriptOptions.length > 1 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500">點擊選用：</div>
                  {scriptOptions.map((s, i) => (
                    <button key={i} onClick={() => setScript(s)}
                      className={`w-full text-left text-xs p-2 rounded-lg border transition-all ${script === s ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="font-medium text-gray-600">腳本 {i+1}：</span>
                      {s.slice(0, 60)}…
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Script editor */}
            <div className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-700">主播腳本</span>
                <span className="text-xs text-gray-400">{script.length} 字</span>
              </div>
              <textarea value={script} onChange={e => setScript(e.target.value)}
                rows={8}
                placeholder="輸入主播要朗讀的腳本…&#10;&#10;例：大家好！我是 AI Gate 的智能助理，今天要向您介紹我們最新的 AI 行銷解決方案…"
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
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

interface Unit12Data {
  systemPrompt?: string
  knowledgeBase?: string
  escalationThreshold?: 'medium' | 'high'
  replyLanguage?: string
  logs?: CsLogEntry[]
  dialogueFiles?: CsDialogueFile[]
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

type Cs12Tab = 'platforms' | 'ai-settings' | 'dialogue-files' | 'data-sources' | 'test' | 'logs'

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
  }
}

function Unit12CustomerService({
  campaignId,
  savedData,
  unit2Data,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit12Data
  unit2Data?: Unit2Data
  onDone: (data: Unit12Data) => void
}) {
  const [tab, setTab] = useState<Cs12Tab>('platforms')

  // AI settings
  const [systemPrompt, setSystemPrompt] = useState(savedData?.systemPrompt ?? '')
  const [knowledgeBase, setKnowledgeBase] = useState(savedData?.knowledgeBase ?? '')
  const [escalationThreshold, setEscalationThreshold] = useState<'medium' | 'high'>(savedData?.escalationThreshold ?? 'high')
  const [replyLanguage, setReplyLanguage] = useState(savedData?.replyLanguage ?? 'auto')

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
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles })
      }
    } finally {
      setUploadingDialogue(false)
    }
  }

  const removeDialogueFile = (url: string) => {
    const newFiles = dialogueFiles.filter(f => f.url !== url)
    setDialogueFiles(newFiles)
    onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles })
  }

  // Test chat
  const [testInput, setTestInput] = useState('')
  const [testHistory, setTestHistory] = useState<{ role: 'user' | 'assistant'; content: string; meta?: { intent?: string; risk?: string; provider?: string } }[]>([])
  const [testLoading, setTestLoading] = useState(false)

  // Logs
  const [logs, setLogs] = useState<CsLogEntry[]>(savedData?.logs ?? [])

  // Data sources
  const [dataSources, setDataSources] = useState<CsDataSource[]>([])
  const [dsLoading, setDsLoading] = useState(false)
  const [editingDs, setEditingDs] = useState<CsDataSource | null>(null)
  const [editingDsForm, setEditingDsForm] = useState<CsDataSource['config'] & { name: string }>({
    name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [],
  })
  const [savingDs, setSavingDs] = useState(false)

  useEffect(() => {
    fetch('/api/marketing/cs-datasource').then(r => r.json()).then(d => {
      if (d.sources) setDataSources(d.sources)
    }).catch(() => {})
  }, [])

  function openAddDs() {
    setEditingDs({ id: '', name: '', enabled: true, config: { apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [] } })
    setEditingDsForm({ name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [] })
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
          body: JSON.stringify({ name: editingDsForm.name, config }),
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
    // Use savedData.dialogueFiles as fallback if local state is empty (prevents accidental overwrite)
    const filesToSave = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
    const data: Unit12Data = { systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: filesToSave }
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
        setTestHistory(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          meta: { intent: data.intent, risk: data.risk, provider: data.provider },
        }])
        const updatedLogs = [newEntry, ...logs].slice(0, 100)
        setLogs(updatedLogs)
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs: updatedLogs, dialogueFiles })
      } else {
        setTestHistory(prev => [...prev, { role: 'assistant', content: `錯誤：${data.error ?? '未知錯誤'}` }])
      }
    } catch (e) {
      setTestHistory(prev => [...prev, { role: 'assistant', content: `連線錯誤：${String(e)}` }])
    }
    setTestLoading(false)
  }

  const riskColor = (r: string) =>
    r === 'high' ? 'text-red-600 bg-red-50' :
    r === 'medium' ? 'text-amber-600 bg-amber-50' :
    'text-green-600 bg-green-50'

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
        <div className="flex gap-1.5">
          {(['platforms', 'ai-settings', 'dialogue-files', 'data-sources', 'test', 'logs'] as Cs12Tab[]).map(t => {
            const labels: Record<Cs12Tab, string> = { platforms: '平台', 'ai-settings': 'AI 設定', 'dialogue-files': '知識庫', 'data-sources': '資料來源', test: '測試', logs: '記錄' }
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={tab === t ? { background: 'var(--primary)' } : {}}>
                {labels[t]}
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
            <span className="text-xs font-medium text-gray-600">上傳文件（PDF / DOCX / XLSX / TXT）</span>
            <div
              onClick={() => !uploadingDialogue && dialogueInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${uploadingDialogue ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              <input
                ref={dialogueInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.txt"
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

          {dsLoading && <div className="text-xs text-gray-400 text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />載入中…</div>}

          {dataSources.length === 0 && !dsLoading && !editingDs && (
            <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
              尚無資料來源。點擊「新增」設定 Google Sheets 查詢。
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
                { key: 'name', label: '名稱', placeholder: '例：訂單密碼表', secret: false },
                { key: 'apiKey', label: 'Google Sheets API Key', placeholder: 'AIzaSy...', secret: true },
                { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: '1BxiMVs0...（網址列中間那段）', secret: false },
                { key: 'sheetName', label: '工作表名稱（Sheet Name）', placeholder: '工作表1 或 Sheet1', secret: false },
                { key: 'keyColumn', label: '查詢欄位名稱（標題列的欄名）', placeholder: '例：訂單編號', secret: false },
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
                  placeholder="例：密碼,到期日"
                  value={editingDsForm.returnColumns.join(',')}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, returnColumns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

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
            <div>• 客戶訊息包含「觸發關鍵字」時，AI 自動查詢該試算表並附上結果。</div>
            <div>• 例：客戶輸入「訂單 A001 密碼」→ AI 查詢訂單 A001 欄位 → 回覆對應密碼。</div>
          </div>
        </div>
      )}

      {/* ── Tab: Test ───────────────────────────────────────────────────────── */}
      {tab === 'test' && (
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden">
            {/* Chat header */}
            <div className="bg-gray-50 border-b px-4 py-2.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-gray-700">客服測試對話</span>
              <span className="text-[10px] text-gray-400 ml-auto">Gemini + Claude 路由</span>
              {testHistory.length > 0 && (
                <button onClick={() => setTestHistory([])} className="text-[10px] text-gray-400 hover:text-gray-600 ml-1">清除</button>
              )}
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
              {testHistory.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-10">
                  在下方輸入框模擬客戶訊息，測試 AI 客服回覆。
                </div>
              )}
              {testHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                      style={msg.role === 'user' ? { background: 'var(--primary)' } : {}}>
                      {msg.content}
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
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">AI 思考中…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t px-3 py-2.5 flex gap-2 bg-gray-50">
              <input
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTestMessage() } }}
                placeholder="輸入客戶訊息… (Enter 送出)"
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

          {/* Quick test phrases */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-medium">快速測試語句：</div>
            <div className="flex flex-wrap gap-2">
              {[
                '你們的產品怎麼收費？',
                '我想退款，已付款 3 天了',
                '帳號無法登入',
                '你們有提供試用嗎？',
                '我要投訴你們的服務！',
                'I would like to know more about your services',
                'Tôi muốn hỏi về sản phẩm của bạn',
              ].map(phrase => (
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
        <div className="space-y-3">
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

  const [activeUnit, setActiveUnit] = useState(1)
  const [unitStatuses, setUnitStatuses] = useState<Record<number, UnitStatus>>({})
  const [unitData, setUnitData] = useState<Record<number, unknown>>({})

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
  useEffect(() => {
    const run = async () => {
      const list = await loadCampaigns()
      if (!list?.length) return

      // Prefer localStorage (last manually selected), fallback to most recently updated
      const lastId = typeof window !== 'undefined'
        ? (localStorage.getItem('aigate_last_campaign') ?? list[0].id)
        : list[0].id

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
  }, [loadCampaigns])

  const createCampaign = useCallback(async (): Promise<string | null> => {
    setCreating(true)
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: campaignTitle }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.id) { setCampaignId(data.id); loadCampaigns(); if (typeof window !== 'undefined') localStorage.setItem('aigate_last_campaign', data.id); return data.id as string }
    return null
  }, [campaignTitle, loadCampaigns])

  const loadCampaign = async (id: string) => {
    const res = await fetch(`/api/marketing/campaign/${id}`)
    if (!res.ok) return
    const c = (await res.json()).campaign
    setCampaignId(c.id)
    setCampaignTitle(c.title ?? '未命名行銷專案')
    setUnitStatuses(c.unit_statuses ?? {})
    setUnitData(c.unit_data ?? {})
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

  const handleUnit12Done = useCallback(async (data: Unit12Data) => {
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(12, data, cid)
  }, [ensureCampaign, saveUnitResult])

  const currentUnit = UNITS.find(u => u.id === activeUnit) ?? UNITS[0]

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

        <div className="p-3 border-t space-y-2">
          <a href="/marketing-pipeline"
            className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors text-amber-600 hover:bg-amber-50">
            <Zap className="h-3.5 w-3.5" /> 自動化流程
          </a>
          <a href="/settings"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2">
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
            <h1 className="font-bold text-base text-gray-900">{currentUnit.id}. {currentUnit.name}</h1>
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
              onDone={handleUnit5Done}
            />
          )}
          {activeUnit === 6 && (
            <Unit6ImageGenerate
              campaignId={campaignId}
              savedData={unitData[6] as Unit6Data | undefined}
              unit5Data={unitData[5] as Unit5Data | undefined}
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
              onDone={handleUnit7Done}
            />
          )}
          {activeUnit === 8 && (
            <Unit8VideoGenerate
              campaignId={campaignId}
              savedData={unitData[8] as Unit8Data | undefined}
              unit6Data={unitData[6] as Unit6Data | undefined}
              unit7Data={unitData[7] as Unit7Data | undefined}
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
            <Unit10PhoneMarketing
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
              onDone={handleUnit12Done}
            />
          )}
          {activeUnit !== 1 && activeUnit !== 2 && activeUnit !== 3 && activeUnit !== 4 && activeUnit !== 5 && activeUnit !== 6 && activeUnit !== 7 && activeUnit !== 8 && activeUnit !== 9 && activeUnit !== 10 && activeUnit !== 11 && activeUnit !== 12 && <ComingSoon unit={currentUnit} />}
        </div>
      </main>
    </div>
  )
}
