'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Map, Pencil, Trash2, Check, CheckCircle2, AlertCircle,
  Loader2, FileText, Zap, Clock,
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
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [compiledAt, setCompiledAt] = useState<Date | null>(null)
  const [compiledChars, setCompiledChars] = useState<number | null>(null)
  const [compileError, setCompileError] = useState('')
  const [loading, setLoading] = useState(true)

  // Load existing data
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => {
        if (d.data && Object.keys(d.data).length > 0) {
          const { files: f, branches: b, ...rest } = d.data as CompanyData
          setForm(rest)
          setFiles(f ?? [])
          setBranches(b ?? [])
        }
        if (d.compiled_md) {
          setCompiledChars(d.compiled_md.length)
          setCompiledAt(new Date()) // we don't have timestamp, just show it exists
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof CompanyData, value: string) =>
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

  const handleRemove = (url: string) => setFiles(prev => prev.filter(f => f.url !== url))

  const handleSave = async () => {
    setSaving(true)
    const data: CompanyData = { ...form, files, branches }
    await fetch('/api/marketing/company-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleCompile = async () => {
    setCompiling(true); setCompileError('')
    try {
      const res = await fetch('/api/marketing/company-data/compile', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setCompiledChars(d.chars)
      setCompiledAt(new Date())
    } catch (e) {
      setCompileError(String(e))
    } finally {
      setCompiling(false)
    }
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

      {/* Compile status banner */}
      <div className={`rounded-2xl border p-5 ${compiledChars ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`h-4 w-4 ${compiledChars ? 'text-green-600' : 'text-amber-600'}`} />
              <span className={`text-sm font-semibold ${compiledChars ? 'text-green-800' : 'text-amber-800'}`}>
                {compiledChars ? 'AI 快取已就緒' : '尚未編譯'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {compiledChars
                ? `已編譯 ${compiledChars.toLocaleString()} 字元的公司資料快取，行銷自動化讀取時直接使用，節省 Token 消耗。`
                : '新增或修改公司資料後，點擊「一鍵轉檔」，行銷自動化模組將使用快取版本，無需每次重新讀取。'}
            </p>
            {compiledAt && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                本次編譯：{compiledAt.toLocaleTimeString()}
              </p>
            )}
            {compileError && (
              <p className="text-xs text-red-600 mt-1">{compileError}</p>
            )}
          </div>
          <button
            onClick={handleCompile}
            disabled={compiling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap disabled:opacity-60 shrink-0"
            style={{ background: 'var(--primary)' }}>
            {compiling
              ? <><Loader2 className="h-4 w-4 animate-spin" />編譯中…</>
              : <><Zap className="h-4 w-4" />一鍵轉檔</>}
          </button>
        </div>
      </div>

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
          {textField('products', '主要產品 / 服務', '描述主要產品或服務項目、特色功能…', true)}
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
            <CheckCircle2 className="h-4 w-4" />已儲存，請記得按「一鍵轉檔」更新快取
          </span>
        )}
      </div>

    </div>
  )
}
