'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader2, Eye, EyeOff, RotateCcw } from 'lucide-react'

const IMAP_PRESETS: Record<string, { host: string; port: number }> = {
  'Gmail':   { host: 'imap.gmail.com',    port: 993 },
  'Outlook': { host: 'imap-mail.outlook.com', port: 993 },
  'Yahoo':   { host: 'imap.mail.yahoo.com', port: 993 },
  '自訂':    { host: '', port: 993 },
}

interface EmailSetting {
  id: string
  email_address: string
  imap_host: string
  imap_port: number
  imap_folder: string
  sync_enabled: boolean
  last_synced_at: string | null
  last_sync_count: number | null
  last_sync_error: string | null
  property_id: string | null
  properties?: { name: string }
}
interface Property { id: string; name: string }

export default function EmailPage() {
  const [settings, setSettings]   = useState<EmailSetting[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string | null>(null)
  const [adding, setAdding]       = useState(false)
  const [showPw, setShowPw]       = useState(false)
  const [preset, setPreset]       = useState('Gmail')
  const [form, setForm]           = useState({
    email_address: '', imap_host: 'imap.gmail.com', imap_port: 993,
    imap_user: '', imap_password: '', imap_folder: 'INBOX', property_id: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/booking/email').then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ]).then(([em, pr]) => {
      setSettings(em.settings ?? [])
      setProperties(pr.properties ?? [])
    }).finally(() => setLoading(false))
  }, [])

  function applyPreset(name: string) {
    setPreset(name)
    const p = IMAP_PRESETS[name]
    setForm(f => ({ ...f, imap_host: p.host, imap_port: p.port }))
  }

  async function sync(id?: string, reset = false) {
    const key = id ?? 'all'
    setSyncing(key)
    try {
      const res = await fetch('/api/booking/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { setting_id: id, reset } : { reset }),
      })
      const d = await res.json()
      const total = (d.results ?? []).reduce((s: number, r: { added: number }) => s + r.added, 0)
      alert(`同步完成，共新增 ${total} 筆訂單`)
      const em = await fetch('/api/booking/email').then(r => r.json())
      setSettings(em.settings ?? [])
    } finally {
      setSyncing(null)
    }
  }

  async function updateProperty(id: string, property_id: string) {
    const res = await fetch('/api/booking/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, property_id: property_id || null }),
    })
    const d = await res.json()
    if (d.setting) {
      setSettings(prev => prev.map(s => s.id === id ? { ...s, property_id: d.setting.property_id, properties: d.setting.properties } : s))
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.setting) {
        setSettings(prev => [...prev, d.setting])
        setAdding(false)
        resetForm()
      } else alert(d.error)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setForm({ email_address: '', imap_host: 'imap.gmail.com', imap_port: 993, imap_user: '', imap_password: '', imap_folder: 'INBOX', property_id: '' })
    setPreset('Gmail')
    setShowPw(false)
  }

  async function del(id: string) {
    if (!confirm('確定刪除此 Email 同步設定？')) return
    await fetch('/api/booking/email', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSettings(prev => prev.filter(s => s.id !== id))
  }

  async function toggleEnable(s: EmailSetting) {
    await fetch('/api/booking/email', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, sync_enabled: !s.sync_enabled }),
    })
    setSettings(prev => prev.map(x => x.id === s.id ? { ...x, sync_enabled: !x.sync_enabled } : x))
  }

  const hasUnassigned = settings.some(s => !s.property_id)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Email 訂單擷取</h1>
          <p className="text-sm text-gray-500 mt-0.5">連接信箱，自動從各平台訂房確認信解析訂單</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sync(undefined, false)}
            disabled={syncing !== null || settings.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            立即同步全部
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50">
            <Plus className="h-4 w-4" /> 新增信箱
          </button>
        </div>
      </div>

      {/* Gmail App Password hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <div className="font-semibold">Gmail 用戶注意</div>
        <div>需使用「應用程式密碼」而非帳號密碼。至 Google 帳戶 → 安全性 → 兩步驟驗證 → 應用程式密碼 產生 16 碼密碼。</div>
      </div>

      {/* Warning: unassigned settings */}
      {hasUnassigned && properties.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          <div className="font-semibold mb-1">有信箱設定尚未指定房源</div>
          <div>匯入的訂單將無法顯示在房源篩選中。請在下方為每個信箱指定對應房源，然後點「重新從頭同步」。</div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">載入中…</div>
      ) : settings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <Mail className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">尚未設定任何信箱</p>
          <button onClick={() => setAdding(true)} className="text-indigo-600 text-sm hover:underline">+ 新增第一個</button>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map(s => (
            <div key={s.id} className={`bg-white border rounded-xl p-4 space-y-3 ${!s.property_id ? 'border-orange-300' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-sm text-gray-900">{s.email_address}</span>
                  {!s.property_id && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">未指定房源</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnable(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.sync_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.sync_enabled ? '啟用' : '停用'}
                  </button>
                  <button onClick={() => sync(s.id)} disabled={syncing !== null}
                    title="同步新郵件"
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 disabled:opacity-40">
                    {syncing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button onClick={() => {
                    if (confirm('將清除所有「無房源」的 email 訂單並重新同步近 30 天郵件，確定？')) sync(s.id, true)
                  }} disabled={syncing !== null}
                    title="重新從頭同步（清除舊訂單）"
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-40">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button onClick={() => del(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Property assignment */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">對應房源：</span>
                <select
                  value={s.property_id ?? ''}
                  onChange={e => updateProperty(s.id, e.target.value)}
                  className={`flex-1 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${!s.property_id ? 'border-orange-300 bg-orange-50' : ''}`}>
                  <option value="">-- 未指定 --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {s.property_id && (
                  <span className="text-xs text-green-600 shrink-0">指定後點 <RotateCcw className="h-3 w-3 inline" /> 重新同步</span>
                )}
              </div>

              <div className="text-[11px] text-gray-400">{s.imap_host}:{s.imap_port} / {s.imap_folder}</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                {s.last_synced_at && <span>上次同步：{new Date(s.last_synced_at).toLocaleString('zh-TW')}</span>}
                {s.last_sync_count != null && <span>共 {s.last_sync_count} 筆</span>}
                {s.last_sync_error
                  ? <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{s.last_sync_error.slice(0, 60)}</span>
                  : s.last_synced_at && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />正常</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setAdding(false); resetForm() } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-gray-900">新增信箱同步</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">信箱類型</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(IMAP_PRESETS).map(name => (
                  <button key={name} onClick={() => applyPreset(name)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${preset === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Email 地址</label>
              <input value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value, imap_user: e.target.value }))}
                placeholder="your@gmail.com"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-600">IMAP 主機</label>
                <input value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Port</label>
                <input type="number" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">應用程式密碼 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.imap_password}
                  onChange={e => setForm(f => ({ ...f, imap_password: e.target.value }))}
                  placeholder="Gmail 應用程式密碼（16碼）"
                  className="w-full text-sm border rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">收件夾</label>
                <input value={form.imap_folder} onChange={e => setForm(f => ({ ...f, imap_folder: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">房源 <span className="text-red-500">*</span></label>
                <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">-- 請選擇 --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); resetForm() }}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={!form.email_address || !form.imap_password || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
