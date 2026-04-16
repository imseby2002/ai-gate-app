'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Building2, BarChart3, PenLine, Image as ImageIcon,
  Film, Video, Upload, Phone, Mic, Headphones,
  Plus, ChevronDown, Loader2, CheckCircle2, AlertCircle,
  XCircle, RefreshCw, Globe, Map, Star, Target, Newspaper, Settings,
  FileText, X, Download, Sparkles, Wand2
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitStatus = 'idle' | 'running' | 'done' | 'error'
type CollectType = 'news' | 'web' | 'maps' | 'reviews' | 'company' | 'competitors'

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
  { id: 8,  name: '影片產出',  icon: Video,      desc: '行銷影片 AI 生成',              implemented: false },
  { id: 9,  name: '上傳平台',  icon: Upload,     desc: 'FB/IG/YouTube 等自動上傳',      implemented: false },
  { id: 10, name: '電話行銷',  icon: Phone,      desc: 'VBEE 語音外撥行銷',            implemented: false },
  { id: 11, name: '主播行銷',  icon: Mic,        desc: 'HeyGen 虛擬主播影片',          implemented: false },
  { id: 12, name: '客服系統',  icon: Headphones, desc: 'LINE/WhatsApp/Zalo 智能客服',  implemented: false },
]

const COLLECT_TYPE_DEFS: {
  id: CollectType; label: string; icon: React.ElementType; desc: string; needsLocation: boolean
}[] = [
  { id: 'news',        label: '新聞',       icon: Newspaper, desc: 'Apify Google 新聞',   needsLocation: false },
  { id: 'web',         label: '網頁搜尋',    icon: Globe,     desc: 'Tavily 深度搜尋',      needsLocation: false },
  { id: 'maps',        label: 'Google 地圖', icon: Map,       desc: 'Outscraper 地圖資料',  needsLocation: true  },
  { id: 'reviews',     label: '評論',        icon: Star,      desc: 'Outscraper 評論',      needsLocation: true  },
  { id: 'company',     label: '公司資料',    icon: Building2, desc: 'Outscraper 公司清單',  needsLocation: true  },
  { id: 'competitors', label: '競爭對手',    icon: Target,    desc: 'Tavily 競品情報',      needsLocation: false },
]

const RADIUS_OPTIONS = ['1', '3', '5', '10', '20']

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
  keywords?: string
  location?: string
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
  const [selectedTypes, setSelectedTypes] = useState<CollectType[]>(savedData?.types ?? ['web', 'news'])
  const [keywords, setKeywords] = useState(savedData?.keywords ?? '')
  const [location, setLocation] = useState(savedData?.location ?? '')
  const [radius, setRadius] = useState('5')
  const [limit, setLimit] = useState(10)
  const [language, setLanguage] = useState('zh-TW')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Unit1Data | null>(savedData?.summary ? savedData : null)
  const [tab, setTab] = useState<'summary' | 'raw'>('summary')

  const needsLocation = selectedTypes.some(
    t => COLLECT_TYPE_DEFS.find(c => c.id === t)?.needsLocation
  )

  const toggleType = (t: CollectType) =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const run = async () => {
    if (!keywords.trim()) { setError('請輸入關鍵字'); return }
    if (selectedTypes.length === 0) { setError('請至少選一種蒐集類型'); return }
    setRunning(true); setError('')
    try {
      const res = await fetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: selectedTypes, keywords: keywords.trim(), location: location.trim(), radius, limit, language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const out: Unit1Data = { summary: data.summary, raw: data.raw, types: selectedTypes, keywords: keywords.trim(), location: location.trim() }
      setResult(out)
      onDone(out)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div>
        <label className="block text-sm font-semibold mb-3">選擇蒐集項目</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COLLECT_TYPE_DEFS.map(ct => {
            const Icon = ct.icon
            const selected = selectedTypes.includes(ct.id)
            return (
              <button key={ct.id} type="button" onClick={() => toggleType(ct.id)}
                className="flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                style={selected
                  ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)' }
                  : { borderColor: '#e5e7eb' }}>
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0"
                  style={selected ? { color: 'var(--primary)' } : { color: '#9ca3af' }} />
                <div>
                  <div className="text-sm font-medium">{ct.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{ct.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">關鍵字 / 搜尋主題</label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
          placeholder="例如：火鍋餐廳、手機殼品牌、健身房..." />
      </div>

      {/* Location (maps-related) */}
      {needsLocation && (
        <div className="space-y-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <div className="text-sm font-semibold text-blue-800">地圖搜尋設定</div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-blue-700">地點 / 城市 / 地址</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
              placeholder="例如：台北市信義區、新北市板橋區..." />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-blue-700">搜尋半徑</label>
            <div className="flex gap-2 flex-wrap">
              {RADIUS_OPTIONS.map(r => (
                <button key={r} type="button" onClick={() => setRadius(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={radius === r
                    ? { borderColor: 'var(--primary)', background: 'var(--primary)', color: 'white' }
                    : { background: 'white' }}>
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced */}
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

  const removeImage = (url: string) =>
    setImages(prev => { const next = prev.filter(i => i.url !== url); onDone({ images: next }); return next })

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

  const [activeUnit, setActiveUnit] = useState(1)
  const [unitStatuses, setUnitStatuses] = useState<Record<number, UnitStatus>>({})
  const [unitData, setUnitData] = useState<Record<number, unknown>>({})

  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowCampaigns(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadCampaigns = useCallback(async () => {
    const res = await fetch('/api/marketing/campaign')
    if (!res.ok) return
    const data = await res.json()
    setCampaigns(data.campaigns ?? [])
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  const createCampaign = useCallback(async (): Promise<string | null> => {
    setCreating(true)
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: campaignTitle }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.id) { setCampaignId(data.id); loadCampaigns(); return data.id as string }
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
    const cid = await ensureCampaign()
    if (cid) saveUnitResult(2, data, cid)
  }, [ensureCampaign, saveUnitResult])

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
                  <button key={c.id} onClick={() => loadCampaign(c.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-50 text-left ${c.id === campaignId ? 'bg-gray-50 font-medium' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{c.title}</div>
                      <div className="text-gray-400 text-[10px]">{new Date(c.updated_at).toLocaleDateString('zh-TW')}</div>
                    </div>
                    {c.id === campaignId && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                  </button>
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

        <div className="p-3 border-t">
          <a href="/settings"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
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
              savedData={unitData[2] as Unit2Data | undefined}
              onSave={handleUnit2Save}
            />
          )}
          {activeUnit === 3 && (
            <Unit3Analyze
              campaignId={campaignId}
              savedData={unitData[3] as Unit3Data | undefined}
              unit1Data={unitData[1] as { summary?: string; raw?: string } | undefined}
              unit2Data={unitData[2] as Unit2Data | undefined}
              onDone={handleUnit3Done}
            />
          )}
          {activeUnit === 4 && (
            <Unit4Copy
              campaignId={campaignId}
              savedData={unitData[4] as Unit4Data | undefined}
              unit1Data={unitData[1] as { summary?: string } | undefined}
              unit2Data={unitData[2] as Unit2Data | undefined}
              unit3Data={unitData[3] as Unit3Data | undefined}
              onDone={handleUnit4Done}
            />
          )}
          {activeUnit === 5 && (
            <Unit5ImageScript
              campaignId={campaignId}
              savedData={unitData[5] as Unit5Data | undefined}
              unit1Data={unitData[1] as { summary?: string } | undefined}
              unit2Data={unitData[2] as Unit2Data | undefined}
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
              unit2Data={unitData[2] as Unit2Data | undefined}
              unit3Data={unitData[3] as Unit3Data | undefined}
              unit4Data={unitData[4] as Unit4Data | undefined}
              unit5Data={unitData[5] as Unit5Data | undefined}
              onDone={handleUnit7Done}
            />
          )}
          {activeUnit !== 1 && activeUnit !== 2 && activeUnit !== 3 && activeUnit !== 4 && activeUnit !== 5 && activeUnit !== 6 && activeUnit !== 7 && <ComingSoon unit={currentUnit} />}
        </div>
      </main>
    </div>
  )
}
