'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader2, Eye, EyeOff, RotateCcw } from 'lucide-react'

const IMAP_PRESETS: Record<string, { host: string; port: number; folder: string; cancel: string }> = {
  'Gmail':   { host: 'imap.gmail.com',         port: 993, folder: '訂房', cancel: '' },
  'Outlook': { host: 'imap-mail.outlook.com',  port: 993, folder: 'INBOX', cancel: '' },
  'Yahoo':   { host: 'imap.mail.yahoo.com',    port: 993, folder: 'INBOX', cancel: '' },
  '自訂':    { host: '', port: 993, folder: 'INBOX', cancel: '' },
}

interface EmailSetting {
  id: string; email_address: string; imap_host: string; imap_port: number
  imap_folder: string; cancel_folder?: string | null; sync_enabled: boolean; last_synced_at: string | null
  last_sync_count: number | null; last_sync_error: string | null
  property_id: string | null; properties?: { name: string }
}
interface Property { id: string; name: string }

export default function EmailPage() {
  const [settings, setSettings]     = useState<EmailSetting[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState<string | null>(null)
  const [adding, setAdding]         = useState(false)
  const [showPw, setShowPw]         = useState(false)
  const [preset, setPreset]         = useState('Gmail')
  const [mode, setMode]             = useState<'label' | 'auto'>('label')
  const [form, setForm] = useState({
    email_address: '', imap_host: 'imap.gmail.com', imap_port: 993,
    imap_user: '', imap_password: '', imap_folder: '訂房', cancel_folder: '', property_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [folderEdit, setFolderEdit] = useState<{ id: string; label: string; cancel: string } | null>(null)

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
    setMode(p.folder.toUpperCase() === 'INBOX' ? 'auto' : 'label')
    setForm(f => ({ ...f, imap_host: p.host, imap_port: p.port, imap_folder: p.folder, cancel_folder: p.cancel }))
  }

  function applyMode(m: 'label' | 'auto') {
    setMode(m)
    if (m === 'auto') {
      setForm(f => ({ ...f, imap_folder: 'INBOX', cancel_folder: '' }))
    } else {
      setForm(f => ({ ...f, imap_folder: f.imap_folder.toUpperCase() === 'INBOX' ? '訂房' : f.imap_folder }))
    }
  }

  async function sync(id?: string, reset = false) {
    const key = id ?? 'all'
    setSyncing(key)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/booking/email/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { setting_id: id, reset } : { reset }),
      })
      const d = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = d.results ?? []
      const totalAdded = results.reduce((s, r) => s + (r.added ?? 0), 0)
      const lines: string[] = [`新增 ${totalAdded} 筆`]
      for (const r of results) {
        if (r.debug) {
          lines.push(`找到 ${r.debug.found_uids} 封 | 無來源 ${r.debug.no_source ?? 0} | 非訂單 ${r.debug.skipped_not_booking} | AI無回應 ${r.debug.ai_null} | 重複 ${r.debug.skipped_duplicate} | 無入住日 ${r.debug.skipped_no_checkin} | 起始日 ${r.debug.since_date}`)
          if (r.debug.log?.length) lines.push('--- 詳細 ---\n' + r.debug.log.join('\n'))
        }
        if (r.errors?.length) lines.push(`錯誤：${r.errors.join(' / ')}`)
      }
      setSyncMsg(lines.join('\n'))
      const em = await fetch('/api/booking/email').then(r => r.json())
      setSettings(em.settings ?? [])
    } finally { setSyncing(null) }
  }

  async function updateProperty(id: string, property_id: string) {
    const res = await fetch('/api/booking/email', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, property_id: property_id || null }),
    })
    const d = await res.json()
    if (d.setting) {
      setSettings(prev => prev.map(s => s.id === id ? { ...s, property_id: d.setting.property_id, properties: d.setting.properties } : s))
    }
  }

  // 變更擷取模式：imap_folder 填 INBOX = 自動掃描；填標籤名 = 標籤模式。
  // 帶上現有 property_id 以免被後端 PUT 邏輯清空。
  async function updateFolder(s: EmailSetting, imap_folder: string, cancel_folder?: string) {
    const res = await fetch('/api/booking/email', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, imap_folder, cancel_folder: cancel_folder ?? s.cancel_folder ?? '', property_id: s.property_id }),
    })
    const d = await res.json()
    if (d.setting) {
      setSettings(prev => prev.map(x => x.id === s.id ? { ...x, imap_folder: d.setting.imap_folder, cancel_folder: d.setting.cancel_folder } : x))
      setFolderEdit(null)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.setting) { setSettings(prev => [...prev, d.setting]); setAdding(false); resetForm() }
      else alert(d.error)
    } finally { setSaving(false) }
  }

  function resetForm() {
    setForm({ email_address: '', imap_host: 'imap.gmail.com', imap_port: 993, imap_user: '', imap_password: '', imap_folder: '訂房', cancel_folder: '', property_id: '' })
    setPreset('Gmail'); setMode('label'); setShowPw(false)
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


  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Email 訂單擷取</h1>
          <p className="text-sm text-gray-500 mt-0.5">連接信箱，自動從各平台訂房確認信解析訂單</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sync(undefined, false)}
            disabled={syncing !== null || settings.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">同步新郵件</span>
            <span className="sm:hidden">同步</span>
          </button>
          <button
            onClick={() => { if (confirm('將刪除所有未對應房源的 Email 訂單，並重新掃描近 90 天郵件全部重新匯入，確定？')) sync(undefined, true) }}
            disabled={syncing !== null || settings.length === 0}
            title="清除後從頭重新掃描 90 天"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
            {syncing === 'all-reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            <span className="hidden sm:inline">重新從頭同步</span>
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50">
            <Plus className="h-4 w-4" /> 新增信箱
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 whitespace-pre-line font-mono">
          {syncMsg}
        </div>
      )}

      {/* Gmail hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <div className="font-semibold">Gmail 用戶注意</div>
        <div className="text-xs">需使用「應用程式密碼」而非帳號密碼。至 Google 帳戶 → 安全性 → 兩步驟驗證 → 應用程式密碼 產生 16 碼密碼。</div>
      </div>

      {properties.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <div className="font-semibold mb-1">多房型信箱免指定房源</div>
          <div className="text-xs">同一信箱會收到不同房型的訂單，系統會依每封郵件內容自動判斷房型。房源欄位留空即可，毋需手動指定。</div>
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
            <div key={s.id} className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-sm text-gray-900 truncate">{s.email_address}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleEnable(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.sync_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.sync_enabled ? '啟用' : '停用'}
                  </button>
                  <button onClick={() => sync(s.id)} disabled={syncing !== null} title="同步新郵件"
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 disabled:opacity-40">
                    {syncing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { if (confirm('將刪除未對應房源的 Email 訂單，並重新掃描近 90 天郵件，確定？')) sync(s.id, true) }}
                    disabled={syncing !== null} title="重新從頭同步"
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-40">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button onClick={() => del(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">指定房源：</span>
                <select value={s.property_id ?? ''}
                  onChange={e => updateProperty(s.id, e.target.value)}
                  className="flex-1 min-w-0 text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">自動判斷（依郵件內容）</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="text-gray-400">{s.imap_host}:{s.imap_port}</span>
                  <span className={`px-1.5 py-0.5 rounded font-medium ${s.imap_folder.toUpperCase() === 'INBOX' ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                    {s.imap_folder.toUpperCase() === 'INBOX' ? '自動掃描' : `標籤：${s.imap_folder}${s.cancel_folder ? `＋${s.cancel_folder}` : ''}`}
                  </span>
                  {folderEdit?.id !== s.id && (
                    <button onClick={() => setFolderEdit({ id: s.id, label: s.imap_folder.toUpperCase() === 'INBOX' ? '訂房' : s.imap_folder, cancel: s.cancel_folder ?? '' })}
                      className="text-indigo-500 hover:underline">變更模式</button>
                  )}
                </div>
                {folderEdit?.id === s.id && (
                  <div className="bg-gray-50 border rounded-lg p-2 space-y-2">
                    <button onClick={() => updateFolder(s, 'INBOX', '')}
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-medium border bg-white text-gray-600 hover:bg-gray-100">
                      自動掃描整個收件匣（免標籤）
                    </button>
                    <div className="text-[10px] text-gray-400 text-center">— 或使用 Gmail 標籤 —</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-0.5">
                        <label className="text-[10px] text-gray-500">訂房標籤</label>
                        <input value={folderEdit.label} onChange={e => setFolderEdit({ ...folderEdit, label: e.target.value })}
                          placeholder="訂房"
                          className="w-full text-[11px] border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] text-gray-500">取消標籤（選填）</label>
                        <input value={folderEdit.cancel} onChange={e => setFolderEdit({ ...folderEdit, cancel: e.target.value })}
                          placeholder="留空即可"
                          className="w-full text-[11px] border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => updateFolder(s, folderEdit.label.trim() || '訂房', folderEdit.cancel.trim())}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                        套用標籤
                      </button>
                      <button onClick={() => setFolderEdit(null)}
                        className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100">取消</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
                {s.last_synced_at && <span>上次：{new Date(s.last_synced_at).toLocaleString('zh-TW')}</span>}
                {s.last_sync_count != null && <span>{s.last_sync_count} 筆</span>}
                {s.last_sync_error
                  ? <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{s.last_sync_error.slice(0, 50)}</span>
                  : s.last_synced_at && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />正常</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) { setAdding(false); resetForm() } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-gray-900">新增信箱同步</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">信箱類型</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(IMAP_PRESETS).map(name => (
                  <button key={name} onClick={() => applyPreset(name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${preset === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
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
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">擷取模式</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => applyMode('label')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${mode === 'label' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  標籤模式
                  <span className={`block text-[10px] font-normal ${mode === 'label' ? 'text-indigo-100' : 'text-gray-400'}`}>需在 Gmail 設標籤，較準</span>
                </button>
                <button type="button" onClick={() => applyMode('auto')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${mode === 'auto' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  自動掃描
                  <span className={`block text-[10px] font-normal ${mode === 'auto' ? 'text-indigo-100' : 'text-gray-400'}`}>免設標籤，掃整個收件匣</span>
                </button>
              </div>
            </div>
            {mode === 'label' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">訂房標籤</label>
                  <input value={form.imap_folder} onChange={e => setForm(f => ({ ...f, imap_folder: e.target.value }))}
                    placeholder="訂房"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">取消標籤<span className="text-gray-400">（選填）</span></label>
                  <input value={form.cancel_folder} onChange={e => setForm(f => ({ ...f, cancel_folder: e.target.value }))}
                    placeholder="留空即可"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">房源<span className="text-gray-400">（選填）</span></label>
              <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">自動判斷（依郵件內容）</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-[11px] text-indigo-700 leading-relaxed">
              {mode === 'label'
                ? '標籤模式：在 Gmail 將訂房確認信與取消信都貼上同一個「訂房」標籤，系統會直接抓整個標籤的信，不靠關鍵字猜測，並由 AI 自動判斷每封信是預定或取消。標籤名稱需與 Gmail 完全一致。'
                : '自動掃描：免在 Gmail 設標籤，系統直接掃描整個收件匣，靠各訂房平台的寄件者網域與主旨關鍵字判斷訂單，再由 AI 擷取內容。準確度略低於標籤模式，可能漏抓或誤抓非標準格式的信。'}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); resetForm() }}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={!form.email_address || !form.imap_password || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
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
