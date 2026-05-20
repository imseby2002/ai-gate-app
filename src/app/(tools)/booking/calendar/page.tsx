'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

interface Booking {
  id: string; guest_name: string; guest_phone: string; check_in: string; check_out: string
  status: string; platform: string; num_guests: number; total_price: number | null; currency: string
  properties?: { name: string }; property_id: string | null
}
interface Property { id: string; name: string; room_count: number; base_price: number | null; currency: string }

const PLATFORM_COLORS: Record<string, string> = {
  booking_com: 'bg-blue-600', agoda: 'bg-purple-600', airbnb: 'bg-rose-500',
  trip_com: 'bg-sky-500', asiayo: 'bg-orange-500', easytravel: 'bg-cyan-500',
  manual: 'bg-gray-500', direct: 'bg-indigo-600', other: 'bg-gray-400',
}
const PROP_PALETTE = [
  'bg-indigo-600','bg-emerald-600','bg-amber-600','bg-rose-600',
  'bg-violet-600','bg-teal-600','bg-orange-600','bg-pink-600',
]
const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已確認', color: 'bg-green-100 text-green-700' },
  pending:   { label: '待確認', color: 'bg-amber-100 text-amber-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
  completed: { label: '已完成', color: 'bg-gray-100 text-gray-600' },
  no_show:   { label: '未到訪', color: 'bg-orange-100 text-orange-700' },
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay() }
function addDays(ds: string, n: number) {
  const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return toDateStr(d)
}

interface QuickForm {
  property_id: string; guest_name: string; guest_phone: string; guest_email: string
  check_in: string; check_out: string; num_guests: number; total_price: string; platform: string
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProp, setFilterProp] = useState('')
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string>(toDateStr(now))
  const [quickProp, setQuickProp]   = useState<Property | null>(null)
  const [quickForm, setQuickForm]   = useState<QuickForm>({
    property_id: '', guest_name: '', guest_phone: '', guest_email: '',
    check_in: '', check_out: '', num_guests: 1, total_price: '', platform: 'direct',
  })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(year, month)
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
    const params = new URLSearchParams({ from, to, limit: '500' })
    if (filterProp) params.set('property_id', filterProp)
    const [bk, pr] = await Promise.all([
      fetch(`/api/booking/bookings?${params}`).then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ])
    setBookings(bk.bookings ?? [])
    setProperties((pr.properties ?? []).filter((p: Property) => p.room_count > 0))
    setLoading(false)
  }, [year, month, filterProp])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const propColorMap: Record<string, string> = {}
  properties.forEach((p, i) => { propColorMap[p.id] = PROP_PALETTE[i % PROP_PALETTE.length] })

  const visibleProps = filterProp ? properties.filter(p => p.id === filterProp) : properties
  const totalRooms = visibleProps.reduce((s, p) => s + p.room_count, 0)

  const dateBookings: Record<string, Booking[]> = {}
  for (const bk of bookings) {
    if (bk.status === 'cancelled') continue
    const cur = new Date(bk.check_in + 'T00:00:00')
    const end = new Date(bk.check_out + 'T00:00:00')
    while (cur < end) {
      const ds = toDateStr(cur)
      if (!dateBookings[ds]) dateBookings[ds] = []
      dateBookings[ds].push(bk)
      cur.setDate(cur.getDate() + 1)
    }
  }

  function availableCount(ds: string) {
    return Math.max(0, totalRooms - (dateBookings[ds] ?? []).length)
  }

  const daysInMonth   = getDaysInMonth(year, month)
  const firstDay      = getFirstDayOfWeek(year, month)
  const todayStr      = toDateStr(now)
  const monthName     = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  const showAllProps  = !filterProp && properties.length > 1
  const selectedBookings = dateBookings[selected] ?? []

  function chipColor(bk: Booking) {
    return showAllProps ? (propColorMap[bk.property_id ?? ''] ?? 'bg-gray-500') : (PLATFORM_COLORS[bk.platform] ?? 'bg-gray-500')
  }
  function chipLabel(bk: Booking) {
    const g = bk.guest_name || PLATFORM_NAMES[bk.platform] || bk.platform
    if (showAllProps && bk.properties?.name) return `[${bk.properties.name.slice(0, 4)}] ${g}`
    return g
  }

  function openQuick(p: Property, ds: string) {
    setQuickProp(p)
    setQuickForm({
      property_id: p.id, guest_name: '', guest_phone: '', guest_email: '',
      check_in: ds, check_out: addDays(ds, 1),
      num_guests: 1, total_price: p.base_price ? String(p.base_price) : '',
      platform: 'direct',
    })
  }

  async function saveQuick() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quickForm,
          total_price: quickForm.total_price ? parseFloat(quickForm.total_price) : null,
          source: 'manual',
        }),
      })
      const d = await res.json()
      if (d.booking) { setQuickProp(null); fetchData() }
      else alert(d.error)
    } finally { setSaving(false) }
  }

  const selLabel = selected
    ? new Date(selected + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: Calendar ──────────────────────────────────── */}
      <div className="flex flex-col w-[420px] shrink-0 border-r bg-white overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            {properties.length > 0 && (
              <select value={filterProp} onChange={e => { setFilterProp(e.target.value); setSelected(todayStr) }}
                className="border rounded-lg px-2.5 py-1 bg-white text-sm focus:outline-none flex-1 mr-3">
                <option value="">全部房源</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-gray-900 w-28 text-center">{monthName}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          {showAllProps && (
            <div className="flex flex-wrap gap-2">
              {properties.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer hover:underline" onClick={() => setFilterProp(p.id)}>
                  <span className={`w-2 h-2 rounded-sm ${PROP_PALETTE[i % PROP_PALETTE.length]}`} />
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">載入中…</div>
        ) : (
          <div className="flex-1">
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {['日','一','二','三','四','五','六'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e${i}`} className="h-16 border-b border-r bg-gray-50/60" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day  = i + 1
                const ds   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const daybks = dateBookings[ds] ?? []
                const avail  = totalRooms > 0 ? availableCount(ds) : null
                const isFull = avail !== null && avail === 0
                const isToday = ds === todayStr
                const isSel   = ds === selected
                const col = (firstDay + i) % 7
                return (
                  <div key={ds} onClick={() => setSelected(ds)}
                    className={`h-16 border-b border-r p-1 cursor-pointer transition-colors
                      ${isSel ? 'bg-sky-50 ring-2 ring-inset ring-sky-400' : isFull ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'}
                      ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : ''}`}>
                    <div className="flex items-start justify-between">
                      <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-sky-500 text-white' : ''}`}>{day}</span>
                      {avail !== null && totalRooms > 0 && (
                        <span className={`text-[9px] font-bold leading-none px-1 py-0.5 rounded ${isFull ? 'text-red-600' : 'text-gray-400'}`}>
                          {isFull ? '客滿' : `${avail}/${totalRooms}`}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {daybks.slice(0, 2).map((bk, bi) => (
                        <div key={`${bk.id}-${bi}`}
                          className={`text-[9px] text-white px-1 py-px rounded truncate ${chipColor(bk)}`}>
                          {chipLabel(bk)}
                        </div>
                      ))}
                      {daybks.length > 2 && (
                        <div className="text-[9px] text-gray-400 px-0.5">+{daybks.length - 2}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Day panels ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50">
        {/* Available rooms panel */}
        <div className="bg-white border-b">
          <div className="bg-sky-500 text-white px-5 py-3 text-sm font-semibold flex items-center gap-3">
            <span>{selLabel}</span>
            <span>　尚有 <span className="text-xl font-bold">{availableCount(selected)}</span> 間空房</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">載入中…</div>
          ) : visibleProps.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">尚未建立房型</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5">房型名稱</th>
                  <th className="px-3 py-2.5 text-center">當日房價</th>
                  <th className="px-3 py-2.5 text-center">尚有間數</th>
                  <th className="px-3 py-2.5 text-center">預訂間數</th>
                  <th className="px-3 py-2.5 text-center">訂購</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleProps.map(p => {
                  const bksThis = selectedBookings.filter(b => b.property_id === p.id)
                  const av = Math.max(0, p.room_count - bksThis.length)
                  return (
                    <tr key={p.id} className={av === 0 ? 'opacity-40' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-3 py-3 text-center text-gray-700">
                        {p.base_price ? Number(p.base_price).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-600 text-base">{av}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{bksThis.length}</td>
                      <td className="px-3 py-3 text-center">
                        <button disabled={av === 0} onClick={() => openQuick(p, selected)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          加入訂單
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Booked rooms panel */}
        <div className="bg-white flex-1">
          <div className="bg-rose-500 text-white px-5 py-3 text-sm font-semibold flex items-center gap-3">
            <span>{selLabel}</span>
            <span>　已售出 <span className="text-xl font-bold">{selectedBookings.length}</span> 間房間</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">載入中…</div>
          ) : selectedBookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">此日無訂單</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5">房型名稱</th>
                  <th className="text-left px-3 py-2.5">價格</th>
                  <th className="text-left px-3 py-2.5">預訂人</th>
                  <th className="text-left px-3 py-2.5">電話</th>
                  <th className="text-left px-3 py-2.5">來源</th>
                  <th className="text-left px-3 py-2.5">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedBookings.map(bk => {
                  const st = STATUS_MAP[bk.status]
                  return (
                    <tr key={bk.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{bk.properties?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-600">
                        {bk.total_price ? `NT$ ${Number(bk.total_price).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/booking/bookings/${bk.id}`}
                          className="font-medium text-indigo-600 hover:underline">
                          {bk.guest_name || '—'}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{bk.guest_phone || '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{PLATFORM_NAMES[bk.platform] ?? bk.platform}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st?.color ?? 'bg-gray-100 text-gray-600'}`}>
                          {st?.label ?? bk.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick booking modal */}
      {quickProp && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setQuickProp(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">加入訂單</h3>
                <div className="text-xs text-gray-400 mt-0.5">{quickProp.name}　{quickForm.check_in}</div>
              </div>
              <button onClick={() => setQuickProp(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">旅客姓名 *</label>
                <input value={quickForm.guest_name} onChange={e => setQuickForm(f => ({ ...f, guest_name: e.target.value }))}
                  placeholder="王小明"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">電話</label>
                <input value={quickForm.guest_phone} onChange={e => setQuickForm(f => ({ ...f, guest_phone: e.target.value }))}
                  placeholder="0912-345-678"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">入住</label>
                <input type="date" value={quickForm.check_in} onChange={e => setQuickForm(f => ({ ...f, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">退房</label>
                <input type="date" value={quickForm.check_out} onChange={e => setQuickForm(f => ({ ...f, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">人數</label>
                <input type="number" min={1} value={quickForm.num_guests}
                  onChange={e => setQuickForm(f => ({ ...f, num_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">金額</label>
                <input type="number" value={quickForm.total_price}
                  onChange={e => setQuickForm(f => ({ ...f, total_price: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">通路</label>
              <select value={quickForm.platform} onChange={e => setQuickForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setQuickProp(null)}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveQuick} disabled={!quickForm.guest_name || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50">
                {saving ? '儲存中…' : '確認加入'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
