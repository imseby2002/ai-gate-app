'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Map, Trash2, CheckCircle2, AlertCircle,
  Loader2, FileText, Package, ExternalLink,
} from 'lucide-react'

interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
  notes?: string
}

interface UploadedFile {
  url: string
  name: string
  category: 'logo' | 'image' | 'document' | 'faq'
  mimeType: string
  sizeKb: number
  textContent?: string
}

interface CompanyData {
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
  brandTone?: string
  competitiveAdvantage?: string
  branches?: Branch[]
  files?: UploadedFile[]
  productList?: { id: string; name: string; category: string; price: number }[]
}

const INDUSTRY_OPTIONS = [
  '科技/軟體', '製造業', '零售/電商', '金融服務', '醫療健康',
  '餐飲/消費', '教育培訓', '房地產', '物流/運輸', '廣告/行銷', '其他',
]
const EMPLOYEE_OPTIONS = ['1-10人', '11-50人', '51-200人', '201-500人', '501-1000人', '1000人以上']
const TONE_OPTIONS = ['專業/正式', '活潑/年輕', '溫暖/親切', '創新/前衛', '奢華/高端', '親民/平易']

const FILE_CATEGORY_LABEL: Record<UploadedFile['category'], string> = {
  logo: 'Logo / 品牌標誌',
  image: '產品 / 情境圖片',
  document: '公司簡介 / 型錄',
  faq: 'FAQ / 對答資料',
}

function FileUploadZone({
  category, label, accept, files, uploading, onUpload, onRemove,
}: {
  category: UploadedFile['category']
  label: string
  accept: string
  files: UploadedFile[]
  uploading: boolean
  onUpload: (file: File, cat: UploadedFile['category']) => Promise<void>
  onRemove: (url: string) => void
}) {
  const catFiles = files.filter(f => f.category === category)
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      {catFiles.map(f => (
        <div key={f.url} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
          <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="flex-1 truncate text-gray-700">{f.name}</span>
          {f.textContent && <span className="text-green-600 text-[10px]">已萃取</span>}
          <button type="button" onClick={() => onRemove(f.url)}
            className="text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs text-gray-400 cursor-pointer hover:border-primary/50 hover:text-primary transition-colors">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        上傳檔案
        <input type="file" accept={accept} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f, category); e.target.value = '' } }}
          disabled={uploading} />
      </label>
    </div>
  )
}

export function CompanyDataForm() {
  const [form, setForm] = useState<CompanyData>({})
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<NonNullable<CompanyData['productList']>>([])
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [loading, setLoading] = useState(true)

  // Load existing data
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => {
        if (d.data && Object.keys(d.data).length > 0) {
          const { files: f, branches: b, productList: pl, products: _p, ...rest } = d.data as CompanyData
          setForm(rest)
          setFiles(f ?? [])
          setBranches(b ?? [])
          setProducts(pl ?? [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof CompanyData, value: string) =>
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

  const handleRemove = (url: string) => setFiles(prev => prev.filter(f => f.url !== url))

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    const data: CompanyData = { ...form, files }
    const res = await fetch('/api/marketing/company-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    if (!res.ok) { setSaveError(res.status === 403 ? '僅公司管理者或行銷權限可修改公司資料' : '儲存失敗'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const textField = (key: keyof CompanyData, label: string, placeholder: string, multiline?: boolean) => (
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-10">

      <p className="rounded-xl border bg-gray-50 p-4 text-xs text-gray-500">
        全公司共用一份資料：此處與行銷中心「品牌資料」、辦公室行銷「品牌中樞 / 門市 / 產品」為同一份，AI（行銷、客服、Agent）一律即時讀取，不需重複建置。
      </p>

      {/* Basic Info */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">基本資料</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {textField('companyName', '公司名稱 *', '例如：台灣科技股份有限公司')}
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
          {textField('capital', '資本額', '例如：新台幣 1,000 萬元')}
          {textField('founded', '成立年份', '例如：2010')}
          {textField('website', '官方網站', 'https://www.example.com')}
        </div>
        <div className="mt-4">
          {textField('address', '公司地址', '縣市 + 區 + 街道')}
        </div>
      </section>

      {/* Business Description */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">業務描述</h3>
        <div className="space-y-4">
          {textField('description', '公司簡介', '簡述公司背景、發展歷程、核心價值…', true)}
          {textField('targetAudience', '目標客群', '描述主要客戶群體、年齡層、消費習慣…', true)}
          {textField('competitiveAdvantage', '核心競爭優勢', '相較競爭對手，公司最大的優勢是…', true)}
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

      {/* Products — 主檔：mkt_product_profiles */}
      <section>
        <div className="flex items-center justify-between pb-2 border-b mb-4">
          <h3 className="text-sm font-bold text-gray-700">主要產品 / 服務</h3>
          <a href="/mkt?tab=products" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />管理產品
          </a>
        </div>
        {products.length === 0
          ? <p className="text-xs text-gray-400 py-4 text-center">尚未建立產品，請至「行銷 → 產品」新增（可一鍵匯入 POS 品項 / 研發配方）</p>
          : <div className="flex flex-wrap gap-2">
              {products.map(p => (
                <span key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-gray-50 text-xs text-gray-700">
                  <Package className="h-3.5 w-3.5 text-gray-400" />{p.name}{p.price ? <span className="text-gray-400">${p.price}</span> : null}
                </span>
              ))}
            </div>}
      </section>

      {/* Branches — 主檔：fin_stores */}
      <section>
        <div className="flex items-center justify-between pb-2 border-b mb-4">
          <h3 className="text-sm font-bold text-gray-700">門市 / 分公司</h3>
          <a href="/mkt?tab=stores" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />管理門市
          </a>
        </div>
        {branches.length === 0
          ? <p className="text-xs text-gray-400 py-4 text-center">尚未建立門市，請至門市主檔新增</p>
          : <div className="space-y-2">
              {branches.map(b => (
                <div key={b.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-gray-50">
                  <Map className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{b.name}</div>
                    {b.address && <div className="text-xs text-gray-500 mt-0.5">{b.address}</div>}
                    {b.notes && <div className="text-xs text-gray-400 italic">{b.notes}</div>}
                  </div>
                </div>
              ))}
            </div>}
      </section>

      {/* Files */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-4 pb-2 border-b">素材上傳</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {(Object.entries(FILE_CATEGORY_LABEL) as [UploadedFile['category'], string][]).map(([cat, label]) => (
            <FileUploadZone key={cat} category={cat} label={label}
              accept={cat === 'logo' ? '.jpg,.jpeg,.png,.svg,.webp'
                : cat === 'image' ? '.jpg,.jpeg,.png,.webp,.gif'
                : cat === 'document' ? '.pdf,.docx,.doc,.txt'
                : '.xlsx,.xls,.csv,.docx,.doc,.txt'}
              files={files} uploading={uploading}
              onUpload={handleUpload} onRemove={handleRemove} />
          ))}
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

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}>
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" />儲存中…</>
            : <><CheckCircle2 className="h-4 w-4" />儲存公司資料</>}
        </button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />已儲存
          </span>
        )}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>

    </div>
  )
}
