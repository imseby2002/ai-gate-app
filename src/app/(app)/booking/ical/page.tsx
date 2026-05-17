'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const PLATFORMS = [
  { id: 'booking_com', name: 'Booking.com' },
  { id: 'agoda',       name: 'Agoda' },
  { id: 'airbnb',      name: 'Airbnb' },
  { id: 'trip_com',    name: 'Trip.com' },
  { id: 'asiayo',      name: 'AsiaYo' },
  { id: 'easytravel',  name: 'EasyTravel' },
  { id: 'other',       name: '其他平台' },
]

interface ICalSetting {
  id: string; platform: string; platform_name: string; ical_url: string
  sync_enabled: boolean; last_synced_at: string | null; last_sync_count: number | null
  last_sync_error: string | null; properties?: { name: string }
}

interface Property { id: string; name: string }

export default function ICalPage() {
  const [settings, setSettings] = useState<ICalSetting[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ property_id: '', platform: 'booking_com', platform_name: '', ical_url: '', sync_interval: 60 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/booking/ical').then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ]).then(([ic, pr]) => {
      setSettings(ic.settings ?? [])
      setProperties(pr.properties ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function sync(id?: string) {
    setSyncing(id ?? 'all')
    try {
      const res = await fetch('/api/booking/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { setting_id: id } : {}),
      })
      const d = await res.json()
      const total = (d.results ?? []).reduce((s: number, r: { added: number; updated: number }) => s + r.added + r.updated, 0)
      alert(`同步完成，共更新 ${total} 筆訂單`)
      const ic = await fetch('/api/booking/ical').then(r => r.json())
      setSettings(ic.settings ?? [])
    } finally {
      setSyncing(null)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const pName = PLATFORMS.find(p => p.id === form.platform)?.name ?? form.platform_name
      const res = await fetch('/api/booking/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, platform_name: pName }),
      })
      const d = await res.json()
      if (d.setting) {
        setSettings(prev => [...prev, d.setting])
        setAdding(false)
        setForm({ property_id: '', platform: 'booking_com', platform_name: '', ical_url: '', sync_interval: 60 })
      } else alert(d.error)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('確定刪除此 iCal 設定？')) return
    await fetch('/api/booking/ical', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSettings(prev => prev.filter(s => s.id !== id))
  }

  async function toggleEnable(s: ICalSetting) {
    await fetch('/api/booking/ical', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, sync_enabled: !s.sync_enabled }),
    })
    setSettings(prev => prev.map(x => x.id === s.id ? { ...x, sync_enabled: !x.sync_enabled } : x))
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">iCal 同步</h1>
          <p className="text-sm text-gray-500 mt-0.5">自動從各大平台匯入訂單，每小時同步一次</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sync()}
            disabled={syncing !== null || settings.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            立即同步全部
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50">
            <Plus className="h-4 w-4" /> 新增
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">載入中…</div>
      ) : settings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <RefreshCw className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">尚未設定任何 iCal 同步</p>
          <button onClick={() => setAdding(true)} className="text-indigo-600 text-sm hover:underline">+ 新增第一個</button>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map(s => (
            <div key={s.id} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{s.platform_name || s.platform}</span>
                  {s.properties && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s.properties.name}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnable(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.sync_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.sync_enabled ? '啟用' : '停用'}
                  </button>
                  <button onClick={() => sync(s.id)} disabled={syncing !== null}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 disabled:opacity-40">
                    {syncing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button onClick={() => del(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 font-mono truncate">{s.ical_url}</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                {s.last_synced_at && (
                  <span>上次同步：{new Date(s.last_synced_at).toLocaleString('zh-TW')}</span>
                )}
                {s.last_sync_count != null && <span>共 {s.last_sync_count} 筆</span>}
                {s.last_sync_error
                  ? <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{s.last_sync_error.slice(0, 60)}</span>
                  : s.last_synced_at && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />正常</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-gray-900">新增 iCal 同步</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">平台</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">房源（選填）</label>
              <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">-- 未指定 --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">iCal URL <span className="text-red-500">*</span></label>
              <input value={form.ical_url} onChange={e => setForm(f => ({ ...f, ical_url: e.target.value }))}
                placeholder="https://www.booking.com/ical/..."
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
              <p className="text-[10px] text-gray-400">從平台後台的「行事曆設定」或「iCal 匯出」取得</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">同步間隔（分鐘）</label>
              <input type="number" min={15} max={1440} value={form.sync_interval}
                onChange={e => setForm(f => ({ ...f, sync_interval: parseInt(e.target.value) }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={!form.ical_url.trim() || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
