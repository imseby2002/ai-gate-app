'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
  no_show:   'bg-orange-100 text-orange-700',
}

// 注意：不可用 d.toISOString()——這裡的 Date 都是用「本地午夜」建構（如 new Date(ds+'T00:00:00')），
// toISOString() 會轉成 UTC，在 UTC+8（台北）時區下午夜會被轉成前一天，導致訂單全部往前一天顯示。
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay() }
function addDays(ds: string, n: number) {
  const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return toDateStr(d)
}

interface RoomLine { property_id: string; property_name: string; total_price: string; num_guests: number }
interface QuickForm {
  guest_name: string; guest_phone: string; guest_email: string
  platform_booking_id: string
  check_in: string; check_out: string; platform: string
  rooms: RoomLine[]
}

export default function CalendarPage() {
  const t = useTranslations('Booking')
  const locale = useLocale()
  const PLATFORM_NAMES: Record<string, string> = {
    booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
    trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
    manual: t('platform.manual'), direct: t('platform.direct'),
  }
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    confirmed: { label: t('status.confirmed'), color: STATUS_COLORS.confirmed },
    pending:   { label: t('status.pending'),   color: STATUS_COLORS.pending },
    cancelled: { label: t('status.cancelled'), color: STATUS_COLORS.cancelled },
    completed: { label: t('status.completed'), color: STATUS_COLORS.completed },
    no_show:   { label: t('status.no_show'),   color: STATUS_COLORS.no_show },
  }
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProp, setFilterProp] = useState('')
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string>(toDateStr(now))
  const [quickOpen, setQuickOpen]   = useState(false)
  const [quickForm, setQuickForm]   = useState<QuickForm>({
    guest_name: '', guest_phone: '', guest_email: '',
    platform_booking_id: '',
    check_in: '', check_out: '', platform: 'direct', rooms: [],
  })
  const [saving, setSaving] = useState(false)
  // Mobile: toggle between calendar view and detail view
  const [mobileView, setMobileView] = useState<'calendar' | 'detail'>('calendar')

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

  function selectDate(ds: string) {
    setSelected(ds)
    setMobileView('detail')
  }

  const daysInMonth   = getDaysInMonth(year, month)
  const firstDay      = getFirstDayOfWeek(year, month)
  const todayStr      = toDateStr(now)
  const monthName     = new Date(year, month, 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
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
    setQuickOpen(true)
    setQuickForm({
      guest_name: '', guest_phone: '', guest_email: '',
      platform_booking_id: '',
      check_in: ds, check_out: addDays(ds, 1), platform: 'direct',
      rooms: [{ property_id: p.id, property_name: p.name, total_price: p.base_price ? String(p.base_price) : '', num_guests: 1 }],
    })
  }

  // 同一位旅客一次訂多間房型時，不用分開跑一次流程——加進同一筆表單，
  // 送出時每個房型各自建一筆訂單，共用旅客姓名/電話/日期/通路。
  function addRoomLine(propertyId: string) {
    if (!propertyId) return
    const p = properties.find(x => x.id === propertyId)
    if (!p || quickForm.rooms.some(r => r.property_id === propertyId)) return
    setQuickForm(f => ({
      ...f,
      rooms: [...f.rooms, { property_id: p.id, property_name: p.name, total_price: p.base_price ? String(p.base_price) : '', num_guests: 1 }],
    }))
  }
  function removeRoomLine(propertyId: string) {
    setQuickForm(f => f.rooms.length <= 1 ? f : { ...f, rooms: f.rooms.filter(r => r.property_id !== propertyId) })
  }
  function updateRoomLine(propertyId: string, patch: Partial<RoomLine>) {
    setQuickForm(f => ({ ...f, rooms: f.rooms.map(r => r.property_id === propertyId ? { ...r, ...patch } : r) }))
  }

  async function saveQuick() {
    setSaving(true)
    try {
      const results = await Promise.all(quickForm.rooms.map(async r => {
        const res = await fetch('/api/booking/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: r.property_id,
            guest_name: quickForm.guest_name, guest_phone: quickForm.guest_phone, guest_email: quickForm.guest_email,
            platform_booking_id: quickForm.platform_booking_id || null,
            check_in: quickForm.check_in, check_out: quickForm.check_out,
            num_guests: r.num_guests,
            total_price: r.total_price ? parseFloat(r.total_price) : null,
            platform: quickForm.platform,
            source: 'manual',
          }),
        })
        const d = await res.json()
        return { ok: res.ok && !!d.booking, error: d.error as string | undefined, room: r.property_name }
      }))
      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) alert(failed.map(f => `${f.room}：${f.error ?? '儲存失敗'}`).join('\n'))
      if (failed.length < results.length) { setQuickOpen(false); fetchData() }
    } finally { setSaving(false) }
  }

  const selLabel = selected
    ? new Date(selected + 'T00:00:00').toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  // ── Shared sub-panels ───────────────────────────────────

  const CalendarPanel = (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          {properties.length > 0 && (
            <select value={filterProp} onChange={e => { setFilterProp(e.target.value); setSelected(todayStr) }}
              className="border rounded-lg px-2 py-1.5 bg-white text-sm focus:outline-none flex-1 min-w-0">
              <option value="">{t('calendar.allProperties')}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold text-gray-900 w-24 text-center">{monthName}</span>
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

      {/* Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {[0,1,2,3,4,5,6].map(i => (
              <div key={i} className="text-center text-xs font-medium text-gray-500 py-2">{t(`roomgrid.day.${i}`)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="h-14 sm:h-16 border-b border-r bg-gray-50/60" />
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
                <div key={ds} onClick={() => selectDate(ds)}
                  className={`h-14 sm:h-16 border-b border-r p-1 cursor-pointer transition-colors
                    ${isSel ? 'bg-sky-50 ring-2 ring-inset ring-sky-400' : isFull ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'}
                    ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : ''}`}>
                  <div className="flex items-start justify-between">
                    <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-sky-500 text-white' : ''}`}>{day}</span>
                    {avail !== null && totalRooms > 0 && (
                      <span className={`text-[9px] font-bold leading-none px-1 py-0.5 rounded ${isFull ? 'text-red-600' : 'text-gray-400'}`}>
                        {isFull ? t('calendar.full') : `${avail}/${totalRooms}`}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 mt-0.5 hidden sm:block">
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
                  {/* Mobile: just a dot if has bookings */}
                  {daybks.length > 0 && (
                    <div className="sm:hidden flex gap-0.5 mt-0.5">
                      {daybks.slice(0, 3).map((bk, bi) => (
                        <span key={bi} className={`w-1.5 h-1.5 rounded-full ${chipColor(bk)}`} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const DetailPanel = (
    <div className="flex flex-col flex-1 overflow-y-auto bg-gray-50">
      {/* Available rooms panel */}
      <div className="bg-white border-b">
        <div className="bg-sky-500 text-white px-4 py-3 text-sm font-semibold flex items-center gap-3">
          <span>{selLabel}</span>
          <span className="ml-auto">{t('calendar.emptyLabel')} <span className="text-xl font-bold">{availableCount(selected)}</span> {t('calendar.roomUnit')}</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : visibleProps.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('calendar.noRoomTypes')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5">{t('calendar.col.room')}</th>
                <th className="px-3 py-2.5 text-center">{t('calendar.col.price')}</th>
                <th className="px-3 py-2.5 text-center">{t('calendar.col.avail')}</th>
                <th className="px-3 py-2.5 text-center hidden sm:table-cell">{t('calendar.col.booked')}</th>
                <th className="px-3 py-2.5 text-center">{t('calendar.col.order')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleProps.map(p => {
                const bksThis = selectedBookings.filter(b => b.property_id === p.id)
                const av = Math.max(0, p.room_count - bksThis.length)
                return (
                  <tr key={p.id} className={av === 0 ? 'opacity-40' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-3 py-3 text-center text-gray-700 text-xs">
                      {p.base_price ? Number(p.base_price).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600 text-base">{av}</td>
                    <td className="px-3 py-3 text-center text-gray-500 hidden sm:table-cell">{bksThis.length}</td>
                    <td className="px-3 py-3 text-center">
                      <button disabled={av === 0} onClick={() => openQuick(p, selected)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        {t('calendar.add')}
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
        <div className="bg-rose-500 text-white px-4 py-3 text-sm font-semibold flex items-center gap-3">
          <span>{selLabel}</span>
          <span className="ml-auto">{t('calendar.soldLabel')} <span className="text-xl font-bold">{selectedBookings.length}</span> {t('calendar.roomUnit')}</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : selectedBookings.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('calendar.noBookings')}</div>
        ) : (
          <>
            {/* Mobile booking cards */}
            <div className="sm:hidden divide-y">
              {selectedBookings.map(bk => {
                const st = STATUS_MAP[bk.status]
                return (
                  <div key={bk.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/booking/bookings/${bk.id}`} className="font-medium text-indigo-600 truncate">
                        {bk.guest_name || '—'}
                      </Link>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${st?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {st?.label ?? bk.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {bk.properties?.name ?? '—'} · {bk.guest_phone || '—'}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{PLATFORM_NAMES[bk.platform] ?? bk.platform}</span>
                      <span>{bk.total_price ? `NT$ ${Number(bk.total_price).toLocaleString()}` : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5">{t('calendar.bcol.room')}</th>
                  <th className="text-left px-3 py-2.5">{t('calendar.bcol.price')}</th>
                  <th className="text-left px-3 py-2.5">{t('calendar.bcol.booker')}</th>
                  <th className="text-left px-3 py-2.5">{t('calendar.bcol.phone')}</th>
                  <th className="text-left px-3 py-2.5">{t('calendar.bcol.source')}</th>
                  <th className="text-left px-3 py-2.5">{t('calendar.bcol.status')}</th>
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
                        <Link href={`/booking/bookings/${bk.id}`} className="font-medium text-indigo-600 hover:underline">
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
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mobile tab toggle */}
      <div className="sm:hidden flex border-b bg-white shrink-0">
        <button onClick={() => setMobileView('calendar')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2
            ${mobileView === 'calendar' ? 'text-sky-600 border-sky-500' : 'text-gray-500 border-transparent'}`}>
          {t('nav.calendar')}
        </button>
        <button onClick={() => setMobileView('detail')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2
            ${mobileView === 'detail' ? 'text-sky-600 border-sky-500' : 'text-gray-500 border-transparent'}`}>
          {selLabel || t('detail.title')}
        </button>
      </div>

      {/* Desktop: side-by-side | Mobile: single view */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`${mobileView === 'calendar' ? 'flex' : 'hidden'} sm:flex w-full sm:w-[420px] sm:shrink-0 sm:border-r flex-col overflow-hidden`}>
          {CalendarPanel}
        </div>
        <div className={`${mobileView === 'detail' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-1 overflow-hidden`}>
          {DetailPanel}
        </div>
      </div>

      {/* Quick booking modal */}
      {quickOpen && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{t('calendar.quickTitle')}</h3>
                <div className="text-xs text-gray-400 mt-0.5">{t('calendar.roomsSelectedTitle', { count: quickForm.rooms.length })}　{quickForm.check_in}</div>
              </div>
              <button onClick={() => setQuickOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* 已選房型（可加多間，共用下方旅客資訊一次送出） */}
            <div className="space-y-2">
              {quickForm.rooms.map(r => (
                <div key={r.property_id} className="flex items-center gap-2 bg-gray-50 border rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.property_name}</div>
                    <div className="flex gap-2 mt-1">
                      <input type="number" min={1} value={r.num_guests}
                        onChange={e => updateRoomLine(r.property_id, { num_guests: parseInt(e.target.value) || 1 })}
                        title={t('bookings.form.guests')}
                        className="w-16 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                      <input type="number" value={r.total_price}
                        onChange={e => updateRoomLine(r.property_id, { total_price: e.target.value })}
                        placeholder={t('bookings.form.amount')}
                        className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    </div>
                  </div>
                  {quickForm.rooms.length > 1 && (
                    <button onClick={() => removeRoomLine(r.property_id)} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {properties.some(p => !quickForm.rooms.some(r => r.property_id === p.id)) && (
              <select value="" onChange={e => addRoomLine(e.target.value)}
                className="w-full text-xs border rounded-lg px-3 py-2 text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-300">
                <option value="">{t('calendar.addAnotherRoom')}</option>
                {properties.filter(p => !quickForm.rooms.some(r => r.property_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.guestName')}</label>
                <input value={quickForm.guest_name} onChange={e => setQuickForm(f => ({ ...f, guest_name: e.target.value }))}
                  placeholder={t('bookings.form.guestNamePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.phone')}</label>
                <input value={quickForm.guest_phone} onChange={e => setQuickForm(f => ({ ...f, guest_phone: e.target.value }))}
                  placeholder="0912-345-678"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('bookings.form.orderNumber')}</label>
              <input value={quickForm.platform_booking_id} onChange={e => setQuickForm(f => ({ ...f, platform_booking_id: e.target.value }))}
                placeholder={t('bookings.form.orderNumberPlaceholder')}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('detail.checkIn')}</label>
                <input type="date" value={quickForm.check_in} onChange={e => setQuickForm(f => ({ ...f, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('detail.checkOut')}</label>
                <input type="date" value={quickForm.check_out} onChange={e => setQuickForm(f => ({ ...f, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('bookings.form.platform')}</label>
              <select value={quickForm.platform} onChange={e => setQuickForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setQuickOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={saveQuick} disabled={!quickForm.guest_name || quickForm.rooms.length === 0 || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50">
                {saving ? t('bookings.form.saving') : t('calendar.confirmAdd')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
