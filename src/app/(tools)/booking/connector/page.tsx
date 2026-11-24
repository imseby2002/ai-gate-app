'use client'
import { useEffect, useState } from 'react'
import { MonitorSmartphone, Copy, Check, RefreshCw, Trash2, Download } from 'lucide-react'

const CONNECTOR_VERSION = '0.4.3'

interface Device { id: string; name: string | null; last_seen_at: string | null; revoked_at: string | null; created_at: string }
interface Property { id: string; name: string }
interface Unmapped { platform: string; room_name: string; count: number }

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
  const [properties, setProperties] = useState<Property[]>([])
  const [unmapped, setUnmapped] = useState<Unmapped[]>([])
  const [pick, setPick] = useState<Record<string, string>>({})
  const [aliasMsg, setAliasMsg] = useState('')

  async function loadDevices() {
    const r = await fetch('/api/connector/booking/devices').then(r => r.json()).catch(() => ({}))
    setDevices(r.devices ?? [])
  }
  async function loadAliases() {
    const r = await fetch('/api/connector/booking/room-aliases').then(r => r.json()).catch(() => ({}))
    setProperties(r.properties ?? [])
    setUnmapped(r.unmapped ?? [])
  }
  useEffect(() => { loadDevices(); loadAliases() }, [])

  const propName = (id: string) => properties.find(p => p.id === id)?.name ?? '（已刪除房源）'
  const platLabel = (k: string) => PLATFORMS.find(p => p.key === k)?.name ?? k

  async function saveAlias(room_name: string, property_id: string) {
    if (!property_id) return
    setAliasMsg('')
    const r = await fetch('/api/connector/booking/room-aliases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name, property_id }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setAliasMsg(d.error || '儲存失敗'); return }
    setAliasMsg(`已把「${room_name}」加入 ${propName(property_id)} 的別名${d.backfilled ? `，回填 ${d.backfilled} 筆既有訂單` : ''}`)
    loadAliases()
  }

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

      {/* 下載外掛 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">1. 下載並安裝外掛</h2>
        <a href="/connector/aigate-connector.zip" download
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">
          <Download className="h-4 w-4" /> 下載外掛（v{CONNECTOR_VERSION}）
        </a>
        <ol className="text-xs text-gray-500 leading-relaxed list-decimal pl-4 space-y-0.5">
          <li>下載後解壓縮，記住 <code className="bg-gray-100 px-1 rounded">booking</code> 資料夾位置。</li>
          <li>Chrome / Edge 網址列輸入 <code className="bg-gray-100 px-1 rounded">chrome://extensions</code>，右上開「開發者模式」。</li>
          <li>點「載入未封裝項目」→ 選剛剛的 <code className="bg-gray-100 px-1 rounded">booking</code> 資料夾。</li>
          <li>之後更新：下載新版覆蓋同資料夾 →「重新載入」（不要移除重裝，免重新配對）。</li>
        </ol>
      </div>

      {/* 配對碼 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">2. 產生配對碼</h2>
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
        <h2 className="font-semibold text-gray-800">3. 已配對裝置</h2>
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

      {/* 房名對應 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">4. 房名對應</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          各平台房名與系統房名不同時，連接器會留「房型未定」。在此選房源即可把該房名加入
          <b>房型管理的別名</b>（與 Email 同步共用），之後自動配對並回填既有訂單。別名清單於「房型管理」統一維護。
        </p>

        {unmapped.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-amber-600">待對應（連接器抓到、別名仍配不到的房名）</div>
            {unmapped.map(u => {
              const key = `${u.platform}||${u.room_name}`
              return (
                <div key={key} className="flex items-center gap-2 flex-wrap border rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-400 w-24 shrink-0">{platLabel(u.platform)}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1 min-w-[120px]">{u.room_name}
                    <span className="text-xs text-gray-400 ml-1">×{u.count}</span>
                  </span>
                  <select value={pick[key] ?? ''} onChange={e => setPick(s => ({ ...s, [key]: e.target.value }))}
                    className="text-sm border rounded-lg px-2 py-1.5 bg-white">
                    <option value="">選擇房源…</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => saveAlias(u.room_name, pick[key] ?? '')}
                    disabled={!pick[key]}
                    className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
                    加入別名
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">目前沒有待對應的房名。</p>
        )}

        {aliasMsg && <p className="text-sm text-emerald-600">{aliasMsg}</p>}
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
