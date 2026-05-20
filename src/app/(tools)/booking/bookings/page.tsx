'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string; guest_name: string; guest_email: string; guest_phone: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  platform: string; platform_booking_id: string; notes: string
  properties?: { name: string }; created_at: string
}
interface Property { id: string; name: string }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已確認', color: 'bg-green-100 text-green-700' },
  pending:   { label: '待確認', color: 'bg-amber-100 text-amber-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
  completed: { label: '已完成', color: 'bg-gray-100 text-gray-600' },
  no_show:   { label: '未到訪', color: 'bg-orange-100 text-orange-700' },
}
const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}

export default function BookingsPage() {
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProp, setFilterProp]     = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding]       = useState(false)
  const [sortKey, setSortKey]     = useState<'check_in' | 'created_at'>('check_in')
  const [sortDesc, setSortDesc]   = useState(true)
  const [form, setForm] = useState({
    property_id: '', guest_name: '', guest_email: '', guest_phone: '',
    check_in: '', check_out: '', num_guests: 1,
    total_price: '', currency: 'TWD', status: 'confirmed',
    platform: 'direct', notes: '', special_requests: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({ limit: '500' })
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo)   params.set('to', filterTo)
    if (filterStatus) params.set('status', filterStatus)
    if (filterProp)   params.set('property_id', filterProp)
    setLoading(true)
    Promise.all([
      fetch(`/api/booking/bookings?${params}`).then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ]).then(([bk, pr]) => {
      setBookings(bk.bookings ?? [])
      setProperties(pr.properties ?? [])
    }).finally(() => setLoading(false))
  }, [filterStatus, filterProp, filterFrom, filterTo])

  const filtered = bookings.filter(b => {
    if (filterPlatform && b.platform !== filterPlatform) return false
    if (search) {
      const q = search.toLowerCase()
      return (b.guest_name ?? '').toLowerCase().includes(q)
        || (b.guest_phone ?? '').includes(q)
        || (b.guest_email ?? '').toLowerCase().includes(q)
        || (b.platform_booking_id ?? '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(true) }
  }
  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return null
    return sortDesc ? <ChevronDown className="h-3 w-3 inline ml-0.5" /> : <ChevronUp className="h-3 w-3 inline ml-0.5" />
  }

  function exportCSV() {
    const rows = [
      ['旅客','電話','房型','入住','退房','人數','金額','來源','確認碼','狀態','建立日期'],
      ...filtered.map(b => [
        b.guest_name, b.guest_phone, b.properties?.name ?? '', b.check_in, b.check_out,
        b.num_guests, b.total_price ?? '', PLATFORM_NAMES[b.platform] ?? b.platform,
        b.platform_booking_id ?? '', STATUS_MAP[b.status]?.label ?? b.status,
        new Date(b.created_at).toLocaleDateString('zh-TW'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = '訂單匯出.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/booking/bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
  }

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
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">訂單管理</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> 匯出
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> 手動新增
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 bg-white text-sm flex-1 min-w-52">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜尋姓名、電話、確認碼…"
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
              <option value="">全部房型</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="h-3.5 w-3.5" /> 進階
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-400 px-2">
            {filtered.length} 筆
          </div>
        </div>

        {showFilters && (
          <div className="flex gap-2 flex-wrap p-3 bg-gray-50 rounded-xl border">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-xs whitespace-nowrap">入住日期</span>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="border rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-xs">至</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="border rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
              className="border rounded-lg px-2.5 py-1 bg-white text-sm focus:outline-none">
              <option value="">全部通路</option>
              {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterPlatform(''); setSearch(''); setFilterStatus(''); setFilterProp('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">清除篩選</button>
          </div>
        )}
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
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">旅客</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">房型</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('check_in')}>
                  入住 <SortIcon k="check_in" />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">退房</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">人數</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">金額</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">來源</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">狀態</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                  建立 <SortIcon k="created_at" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(b => {
                const st = STATUS_MAP[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={b.id} className="hover:bg-gray-50 group">
                    <td className="px-3 py-2.5">
                      <Link href={`/booking/bookings/${b.id}`}
                        className="font-medium text-indigo-600 group-hover:underline">
                        {b.guest_name || '(無名)'}
                      </Link>
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
                        <div className="text-[10px] text-amber-600 mt-0.5 max-w-[100px] truncate" title={b.notes}>⚠ {b.notes}</div>
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
              { label: '電話',       key: 'guest_phone', placeholder: '0912-345-678' },
              { label: 'Email',      key: 'guest_email', placeholder: 'guest@example.com' },
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">房型</label>
                <select value={form.property_id} onChange={e => setForm(p => ({ ...p, property_id: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">-- 未指定 --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">通路</label>
                <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
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
