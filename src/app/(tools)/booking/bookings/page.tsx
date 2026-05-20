'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Filter } from 'lucide-react'

interface Booking {
  id: string; guest_name: string; guest_email: string; guest_phone: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  platform: string; notes: string; properties?: { name: string }
  created_at: string
}
interface Property { id: string; name: string }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed:  { label: '已確認', color: 'bg-green-100 text-green-700' },
  pending:    { label: '待確認', color: 'bg-amber-100 text-amber-700' },
  cancelled:  { label: '已取消', color: 'bg-red-100 text-red-600' },
  completed:  { label: '已完成', color: 'bg-gray-100 text-gray-600' },
  no_show:    { label: '未到訪', color: 'bg-orange-100 text-orange-700' },
}
const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProp, setFilterProp] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    property_id: '', guest_name: '', guest_email: '', guest_phone: '',
    check_in: '', check_out: '', num_guests: 1,
    total_price: '', currency: 'TWD', status: 'confirmed',
    platform: 'direct', notes: '', special_requests: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/booking/bookings?limit=500').then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ]).then(([bk, pr]) => {
      setBookings(bk.bookings ?? [])
      setProperties(pr.properties ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = bookings.filter(b => {
    if (filterStatus && b.status !== filterStatus) return false
    if (filterProp && b.properties?.name !== filterProp) return false
    if (search) {
      const q = search.toLowerCase()
      return (b.guest_name ?? '').toLowerCase().includes(q)
        || (b.guest_phone ?? '').includes(q)
        || (b.guest_email ?? '').toLowerCase().includes(q)
    }
    return true
  })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, total_price: form.total_price ? parseFloat(form.total_price) : null }),
      })
      const d = await res.json()
      if (d.booking) {
        setBookings(prev => [d.booking, ...prev])
        setAdding(false)
        setForm({ property_id: '', guest_name: '', guest_email: '', guest_phone: '', check_in: '', check_out: '', num_guests: 1, total_price: '', currency: 'TWD', status: 'confirmed', platform: 'direct', notes: '', special_requests: '' })
      } else alert(d.error)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/booking/bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">訂單管理</h1>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> 手動新增
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 bg-white text-sm flex-1 min-w-40">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋旅客姓名、電話…"
            className="flex-1 outline-none text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
          <option value="">全部狀態</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {properties.length > 0 && (
          <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
            className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
            <option value="">全部房源</option>
            {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-400 px-2">
          <Filter className="h-3.5 w-3.5" />
          {filtered.length} 筆
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">無符合的訂單</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['旅客', '房源', '入住', '退房', '人數', '金額', '來源', '狀態', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(b => {
                const st = STATUS_MAP[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{b.guest_name || '—'}</div>
                      {b.guest_phone && <div className="text-xs text-gray-400">{b.guest_phone}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{b.properties?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.check_in}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.check_out}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.num_guests}</td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {b.total_price ? `${b.currency} ${Number(b.total_price).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{PLATFORM_NAMES[b.platform] ?? b.platform}</td>
                    <td className="px-3 py-2.5">
                      <select value={b.status} onChange={e => updateStatus(b.id, e.target.value)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${st.color}`}>
                        {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      <div>{new Date(b.created_at).toLocaleDateString('zh-TW')}</div>
                      {b.notes && (
                        <div className="text-[10px] text-amber-600 mt-0.5 max-w-[120px] truncate" title={b.notes}>
                          ⚠ {b.notes}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {adding && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-gray-900">新增訂單</h3>
            {[
              { label: '旅客姓名 *', key: 'guest_name', placeholder: '王小明' },
              { label: '電話', key: 'guest_phone', placeholder: '0912-345-678' },
              { label: 'Email', key: 'guest_email', placeholder: 'guest@example.com' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{f.label}</label>
                <input value={(form as Record<string, string | number>)[f.key] as string}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">入住 *</label>
                <input type="date" value={form.check_in} onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">退房 *</label>
                <input type="date" value={form.check_out} onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">人數</label>
                <input type="number" min={1} value={form.num_guests} onChange={e => setForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">金額</label>
                <input type="number" value={form.total_price} onChange={e => setForm(p => ({ ...p, total_price: e.target.value }))}
                  placeholder="5000"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">房源</label>
              <select value={form.property_id} onChange={e => setForm(p => ({ ...p, property_id: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">-- 未指定 --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">備註</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={!form.guest_name || !form.check_in || !form.check_out || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '儲存中…' : '新增'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
