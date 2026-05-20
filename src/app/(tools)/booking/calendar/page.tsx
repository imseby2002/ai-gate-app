'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string; guest_name: string; check_in: string; check_out: string
  status: string; platform: string; num_guests: number; total_price: number | null; currency: string
  properties?: { name: string }; property_id: string | null
}
interface Property { id: string; name: string; room_count: number }

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

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay() }

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProp, setFilterProp] = useState('')
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string | null>(null)

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

  // totalRooms = sum of room_count for active properties (filtered if needed)
  const visibleProps = filterProp ? properties.filter(p => p.id === filterProp) : properties
  const totalRooms = visibleProps.reduce((s, p) => s + p.room_count, 0)

  // Date → bookings map (include cancelled as "not blocking")
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

  function availableRooms(ds: string) {
    const occupied = (dateBookings[ds] ?? []).length
    return Math.max(0, totalRooms - occupied)
  }

  const daysInMonth   = getDaysInMonth(year, month)
  const firstDay      = getFirstDayOfWeek(year, month)
  const todayStr      = toDateStr(now)
  const monthName     = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  const showAllProps  = !filterProp && properties.length > 1

  function chipColor(bk: Booking) {
    return showAllProps ? (propColorMap[bk.property_id ?? ''] ?? 'bg-gray-500') : (PLATFORM_COLORS[bk.platform] ?? 'bg-gray-500')
  }
  function chipLabel(bk: Booking) {
    const g = bk.guest_name || PLATFORM_NAMES[bk.platform] || bk.platform
    if (showAllProps && bk.properties?.name) return `[${bk.properties.name.slice(0, 4)}] ${g}`
    return g
  }

  // Selected day breakdown: available rooms per property + booked list
  const selectedBookings = selected ? (dateBookings[selected] ?? []) : []
  const bookedPropIds = new Set(selectedBookings.map(b => b.property_id))

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">訂房日曆</h1>
        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <select value={filterProp} onChange={e => { setFilterProp(e.target.value); setSelected(null) }}
              className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
              <option value="">全部房源</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold text-gray-900 w-32 text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-24 text-gray-400">載入中…</div> : (
        <>
          {showAllProps && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {properties.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1 cursor-pointer hover:underline" onClick={() => setFilterProp(p.id)}>
                  <span className={`w-2.5 h-2.5 rounded-sm ${PROP_PALETTE[i % PROP_PALETTE.length]}`} />
                  {p.name}（{p.room_count}間）
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {['日','一','二','三','四','五','六'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e${i}`} className="min-h-[96px] border-b border-r bg-gray-50/50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const daybks  = dateBookings[ds] ?? []
                const avail   = totalRooms > 0 ? availableRooms(ds) : null
                const isFull  = avail !== null && avail === 0
                const isToday = ds === todayStr
                const isSel   = ds === selected
                const col     = (firstDay + i) % 7
                return (
                  <div key={ds} onClick={() => setSelected(isSel ? null : ds)}
                    className={`min-h-[96px] border-b border-r p-1.5 cursor-pointer transition-colors
                      ${isSel ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : isFull ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-gray-50'}
                      ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-indigo-600 text-white' : ''}`}>{day}</span>
                      {avail !== null && totalRooms > 0 && (
                        <span className={`text-[9px] font-bold px-1 rounded ${isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {isFull ? '客滿' : `${avail}/${totalRooms}`}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {daybks.slice(0, 2).map((bk, bi) => (
                        <div key={`${bk.id}-${bi}`}
                          className={`text-[10px] text-white px-1 py-0.5 rounded truncate ${chipColor(bk)}`}>
                          {chipLabel(bk)}
                        </div>
                      ))}
                      {daybks.length > 2 && (
                        <div className="text-[10px] text-gray-400 px-1">+{daybks.length - 2} 筆</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {!showAllProps && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {Object.entries(PLATFORM_NAMES).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${PLATFORM_COLORS[k]}`} />{v}
                </div>
              ))}
            </div>
          )}

          {/* Selected day panel — TRAIWAN style two columns */}
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Available rooms */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5">
                  {new Date(selected + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
                  　尚有 <span className="text-lg">{availableRooms(selected)}</span> 間空房
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2">房型</th>
                      <th className="px-2 py-2 text-center">總間數</th>
                      <th className="px-2 py-2 text-center">已訂</th>
                      <th className="px-2 py-2 text-center">空房</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleProps.map(p => {
                      const bksThisProp = selectedBookings.filter(b => b.property_id === p.id)
                      const av = Math.max(0, p.room_count - bksThisProp.length)
                      return (
                        <tr key={p.id} className={av === 0 ? 'opacity-40' : ''}>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                          <td className="px-2 py-2.5 text-center text-gray-600">{p.room_count}</td>
                          <td className="px-2 py-2.5 text-center text-red-500">{bksThisProp.length}</td>
                          <td className="px-2 py-2.5 text-center font-bold text-emerald-600">{av}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Booked orders */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="bg-rose-500 text-white text-sm font-semibold px-4 py-2.5">
                  {new Date(selected + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
                  　已售出 <span className="text-lg">{selectedBookings.length}</span> 間
                </div>
                {selectedBookings.length === 0 ? (
                  <div className="text-sm text-gray-400 p-4">此日無訂單</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">旅客</th>
                        <th className="text-left px-2 py-2">房型</th>
                        <th className="text-left px-2 py-2">通路</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedBookings.map(bk => (
                        <tr key={bk.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <Link href={`/booking/bookings/${bk.id}`}
                              className="font-medium text-indigo-600 hover:underline">
                              {bk.guest_name || '—'}
                            </Link>
                            <div className="text-xs text-gray-400">{bk.check_in} → {bk.check_out}</div>
                          </td>
                          <td className="px-2 py-2.5 text-xs text-gray-600">{bk.properties?.name ?? '—'}</td>
                          <td className="px-2 py-2.5 text-xs text-gray-500">{PLATFORM_NAMES[bk.platform] ?? bk.platform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
