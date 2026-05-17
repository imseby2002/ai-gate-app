'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Booking {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  platform: string
  num_guests: number
  properties?: { name: string }
  property_id: string
}

interface Property { id: string; name: string }

const PLATFORM_COLORS: Record<string, string> = {
  booking_com: 'bg-blue-600',
  agoda:       'bg-purple-600',
  airbnb:      'bg-rose-500',
  trip_com:    'bg-sky-500',
  asiayo:      'bg-orange-500',
  easytravel:  'bg-cyan-500',
  manual:      'bg-gray-500',
  direct:      'bg-indigo-600',
  other:       'bg-gray-400',
}

const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProp, setFilterProp] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
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
    setProperties(pr.properties ?? [])
    setLoading(false)
  }, [year, month, filterProp])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  // Build a map: dateStr -> bookings that cover this date
  const dateBookings: Record<string, Booking[]> = {}
  for (const bk of bookings) {
    const cur = new Date(bk.check_in)
    const end = new Date(bk.check_out)
    while (cur < end) {
      const ds = toDateStr(cur)
      if (!dateBookings[ds]) dateBookings[ds] = []
      dateBookings[ds].push(bk)
      cur.setDate(cur.getDate() + 1)
    }
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const todayStr = toDateStr(now)
  const monthName = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  // Bookings on selected date
  const selectedBookings = selected ? (dateBookings[selected] ?? []) : []

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">訂房日曆</h1>
        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
              className="border rounded-lg px-3 py-1.5 bg-white text-sm focus:outline-none">
              <option value="">全部房源</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-900 w-32 text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-400">載入中…</div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="bg-white rounded-xl border overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] border-b border-r last:border-r-0 bg-gray-50/50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const daybks = dateBookings[ds] ?? []
                const isToday = ds === todayStr
                const isSelected = ds === selected
                const col = (firstDay + i) % 7
                return (
                  <div key={ds}
                    onClick={() => setSelected(isSelected ? null : ds)}
                    className={`min-h-[90px] border-b border-r last:border-r-0 p-1.5 cursor-pointer transition-colors
                      ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : 'hover:bg-gray-50'}
                      ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : ''}`}>
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-indigo-600 text-white' : ''}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {daybks.slice(0, 3).map((bk, bi) => (
                        <div key={`${bk.id}-${bi}`}
                          className={`text-[10px] text-white px-1 py-0.5 rounded truncate ${PLATFORM_COLORS[bk.platform] ?? 'bg-gray-500'}`}>
                          {bk.guest_name || PLATFORM_NAMES[bk.platform] || bk.platform}
                        </div>
                      ))}
                      {daybks.length > 3 && (
                        <div className="text-[10px] text-gray-400 px-1">+{daybks.length - 3} 更多</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Platform legend */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {Object.entries(PLATFORM_NAMES).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm ${PLATFORM_COLORS[k]}`} />
                {v}
              </div>
            ))}
          </div>

          {/* Selected day detail */}
          {selected && (
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-900">
                {new Date(selected + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })}
                <span className="ml-2 text-gray-400 font-normal">共 {selectedBookings.length} 筆</span>
              </div>
              {selectedBookings.length === 0 ? (
                <div className="text-sm text-gray-400">此日無訂單</div>
              ) : (
                <div className="divide-y">
                  {selectedBookings.map(bk => (
                    <div key={bk.id} className="py-2.5 flex items-start gap-3">
                      <span className={`mt-0.5 w-2.5 h-2.5 rounded-sm shrink-0 ${PLATFORM_COLORS[bk.platform] ?? 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{bk.guest_name || '(無名)'}</div>
                        <div className="text-xs text-gray-500">
                          {bk.check_in} → {bk.check_out} · {bk.num_guests} 人
                          {bk.properties?.name && ` · ${bk.properties.name}`}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">{PLATFORM_NAMES[bk.platform] ?? bk.platform}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
