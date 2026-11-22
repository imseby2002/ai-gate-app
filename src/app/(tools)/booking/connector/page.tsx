'use client'
import { useEffect, useState } from 'react'
import { MonitorSmartphone, Copy, Check, RefreshCw, Trash2 } from 'lucide-react'

interface Device { id: string; name: string | null; last_seen_at: string | null; revoked_at: string | null; created_at: string }

const PLATFORMS = [
  { key: 'booking_com', name: 'Booking.com', url: 'admin.booking.com' },
  { key: 'agoda', name: 'Agoda', url: 'ycs.agoda.com' },
  { key: 'trip_com', name: 'Trip.com / Ctrip', url: 'ebooking.trip.com' },
  { key: 'asiayo', name: 'AsiaYo', url: 'expert.asiayo.com' },
  { key: 'expedia', name: 'Expedia', url: 'apps.expediapartnercentral.com' },
]

export default function ConnectorPage() {
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [left, setLeft] = useState(0)
  const [gen, setGen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [err, setErr] = useState('')

  async function loadDevices() {
    const r = await fetch('/api/connector/booking/devices').then(r => r.json()).catch(() => ({}))
    setDevices(r.devices ?? [])
  }
  useEffect(() => { loadDevices() }, [])

  useEffect(() => {
    if (!expiresAt) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setLeft(s)
      if (s === 0) { setCode(null); setExpiresAt(null) }
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  async function generate() {
    setGen(true); setErr('')
    try {
      const r = await fetch('/api/connector/booking/pair-code', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || '產生失敗'); return }
      setCode(d.code)
      setExpiresAt(new Date(d.expires_at).getTime())
    } finally { setGen(false) }
  }

  async function revoke(id: string) {
    if (!window.confirm('撤銷後該裝置需重新配對，確定？')) return
    await fetch('/api/connector/booking/devices', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadDevices()
  }

  function copy() {
    if (!code) return
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-gray-900">讀後台連接器</h1>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed">
        在一台常開、已登入各平台後台的電腦上安裝瀏覽器外掛，<b>唯讀</b>讀取訂單頁，把新訂單／取消即時帶進系統
        （含 Booking.com 通知信抓不到的房號、姓名）。不爬蟲登入、不自動操作平台。
      </p>

      {/* 配對碼 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">1. 產生配對碼</h2>
        <p className="text-xs text-gray-500">在外掛設定頁貼上此配對碼完成綁定（10 分鐘內有效）。</p>
        {code ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-mono font-bold tracking-widest text-indigo-700">{code}</span>
            <button onClick={copy} className="flex items-center gap-1 text-sm px-3 py-1.5 border rounded-lg hover:bg-gray-50">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? '已複製' : '複製'}
            </button>
            <span className="text-xs text-gray-400">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 後失效</span>
          </div>
        ) : (
          <button onClick={generate} disabled={gen}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${gen ? 'animate-spin' : ''}`} /> 產生配對碼
          </button>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>

      {/* 已配對裝置 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">2. 已配對裝置</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-400">尚無裝置。</p>
        ) : (
          <div className="space-y-2">
            {devices.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                <div>
                  <div className={`text-sm font-medium ${d.revoked_at ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{d.name || '裝置'}</div>
                  <div className="text-xs text-gray-400">
                    {d.revoked_at ? '已撤銷' : d.last_seen_at ? `最後上線 ${new Date(d.last_seen_at).toLocaleString('zh-TW')}` : '尚未連線'}
                  </div>
                </div>
                {!d.revoked_at && (
                  <button onClick={() => revoke(d.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 支援平台 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">支援平台</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {PLATFORMS.map(p => (
            <div key={p.key} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
              <span className="font-medium text-gray-800">{p.name}</span>
              <span className="text-xs text-gray-400">{p.url}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          每個平台後台版面不同，外掛需各自調校欄位選擇器（見外掛 README）。外掛為原型，唯讀取資料，屬平台條款灰色地帶，請自行斟酌。
        </p>
      </div>
    </div>
  )
}
