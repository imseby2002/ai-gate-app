'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Lock, Unlock, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Property { id: string; name: string; room_count: number; base_price: number | null }
interface Booking  {
  id: string; property_id: string; guest_name: string | null; guest_phone: string | null
  check_in: string; check_out: string; status: string; total_price: number | null; platform: string
}
interface BlockedDate { property_id: string; date: string; reason: string }

interface GridData {
  from: string; days: number
  properties: Property[]; bookings: Booking[]; blocked: BlockedDate[]
}

type CellState = 'available' | 'booked' | 'blocked'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return toDateStr(d)
}

const DAYS = 21

export default function RoomGridPage() {
  const t = useTranslations('Booking')
  const [from, setFrom]     = useState(() => toDateStr(new Date()))
  const [data, setData]     = useState<GridData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ propId: string; date: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [dragBk, setDragBk] = useState<Booking | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/booking/roomgrid?from=${from}&days=${DAYS}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [from])

  useEffect(() => { load() }, [load])

  const dates: string[] = []
  for (let i = 0; i < DAYS; i++) dates.push(addDays(from, i))

  function cellState(propId: string, date: string): CellState {
    if (!data) return 'available'
    const isBlocked = data.blocked.some(b => b.property_id === propId && b.date === date)
    if (isBlocked) return 'blocked'
    const isBooked = data.bookings.some(b =>
      b.property_id === propId && b.check_in <= date && b.check_out > date
    )
    if (isBooked) return 'booked'
    return 'available'
  }

  function getBooking(propId: string, date: string) {
    if (!data) return null
    return data.bookings.find(b =>
      b.property_id === propId && b.check_in <= date && b.check_out > date
    ) ?? null
  }

  function isSelected(propId: string, date: string) {
    return selected.some(s => s.propId === propId && s.date === date)
  }

  // 拖拉換房/改期：把整筆訂單移到新房型，入住日對齊放下的日期，保留原住宿晚數
  async function moveBooking(bk: Booking, newPropId: string, newDate: string) {
    const nightsCount = Math.max(1, Math.round((new Date(bk.check_out).getTime() - new Date(bk.check_in).getTime()) / 86400000))
    const newCheckIn = newDate
    const newCheckOut = addDays(newDate, nightsCount)
    if (newPropId === bk.property_id && newCheckIn === bk.check_in) return
    // 目標區間是否被占用（排除自己）
    for (let i = 0; i < nightsCount; i++) {
      const d = addDays(newDate, i)
      const occupied = (data?.bookings ?? []).some(o =>
        o.id !== bk.id && o.property_id === newPropId && ['pending', 'confirmed'].includes(o.status) && o.check_in <= d && o.check_out > d)
        || (data?.blocked ?? []).some(b => b.property_id === newPropId && b.date === d)
      if (occupied) { setMsg(t('roomgrid.occupied')); setTimeout(() => setMsg(null), 2500); return }
    }
    if (!window.confirm(t('roomgrid.moveConfirm', { name: bk.guest_name ?? t('roomgrid.orderFallback'), in: newCheckIn, out: newCheckOut }))) return
    setSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bk.id, property_id: newPropId, check_in: newCheckIn, check_out: newCheckOut }),
      })
      if (!res.ok) { setMsg(t('roomgrid.moveFailed')); setTimeout(() => setMsg(null), 2500); return }
      setMsg(t('roomgrid.moveDone')); setTimeout(() => setMsg(null), 2000)
      load()
    } finally { setSaving(false) }
  }

  function toggleCell(propId: string, date: string, state: CellState) {
    if (state === 'booked') return
    setSelected(prev => {
      const exists = prev.some(s => s.propId === propId && s.date === date)
      return exists ? prev.filter(s => !(s.propId === propId && s.date === date))
                    : [...prev, { propId, date }]
    })
  }

  async function blockSelected() {
    if (selected.length === 0) return
    setSaving(true)
    const grouped: Record<string, string[]> = {}
    for (const s of selected) {
      if (!grouped[s.propId]) grouped[s.propId] = []
      grouped[s.propId].push(s.date)
    }
    await Promise.all(Object.entries(grouped).map(([propId, dates]) =>
      fetch('/api/booking/blocked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propId, dates }),
      })
    ))
    setSaving(false)
    setSelected([])
    setMsg(t('roomgrid.closedDates'))
    setTimeout(() => setMsg(null), 2000)
    load()
  }

  async function unblockSelected() {
    if (selected.length === 0) return
    setSaving(true)
    const grouped: Record<string, string[]> = {}
    for (const s of selected) {
      if (!grouped[s.propId]) grouped[s.propId] = []
      grouped[s.propId].push(s.date)
    }
    await Promise.all(Object.entries(grouped).map(([propId, dates]) =>
      fetch('/api/booking/blocked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propId, dates }),
      })
    ))
    setSaving(false)
    setSelected([])
    setMsg(t('roomgrid.openedDates'))
    setTimeout(() => setMsg(null), 2000)
    load()
  }

  function clearSelection() { setSelected([]) }

  const selectionHasBlocked = selected.some(s => cellState(s.propId, s.date) === 'blocked')
  const selectionHasAvailable = selected.some(s => cellState(s.propId, s.date) === 'available')

  // 依房型分組（同一房型選多天 = 一筆訂單的入住～退房區間；不同房型各自成一筆）。
  // 只取可訂狀態的格子，已被占用/關閉的選取不會拿去建訂單。
  const selectedGroups = (() => {
    const byProp: Record<string, string[]> = {}
    for (const s of selected) {
      if (cellState(s.propId, s.date) !== 'available') continue
      if (!byProp[s.propId]) byProp[s.propId] = []
      byProp[s.propId].push(s.date)
    }
    return Object.entries(byProp).map(([propId, dts]) => {
      const ds = [...dts].sort()
      return { property_id: propId, check_in: ds[0], check_out: addDays(ds[ds.length - 1], 1) }
    })
  })()
  const bookingQueryStr = selectedGroups.length === 0 ? ''
    : selectedGroups.length === 1
      ? `?property_id=${selectedGroups[0].property_id}&check_in=${selectedGroups[0].check_in}&check_out=${selectedGroups[0].check_out}`
      : `?prefill=${encodeURIComponent(JSON.stringify(selectedGroups))}`

  const today = toDateStr(new Date())
  const dayLabels = [0,1,2,3,4,5,6].map(i => t(`roomgrid.day.${i}`))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b">
        <h1 className="text-base font-bold text-gray-900 mr-2">{t('nav.roomgrid')}</h1>
        <button onClick={() => setFrom(f => addDays(f, -7))}
          className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
        <button onClick={() => setFrom(toDateStr(new Date()))}
          className="px-3 py-1 text-xs rounded-lg border hover:bg-gray-50 font-medium">{t('roomgrid.today')}</button>
        <span className="text-sm text-gray-600 min-w-[120px]">{from} ~ {addDays(from, DAYS - 1)}</span>
        <button onClick={() => setFrom(f => addDays(f, 7))}
          className="p-1.5 rounded hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
        <button onClick={load} className="ml-1 p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border" /> {t('roomgrid.available')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-200" /> {t('roomgrid.booked')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300" /> {t('roomgrid.blocked')}</span>
          <span className="hidden md:inline text-gray-400">{t('roomgrid.dragHint')}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">{t('common.loading')}</div>
        ) : !data || data.properties.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">{t('roomgrid.noRooms')}</div>
        ) : (
          <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              {dates.map(d => <col key={d} style={{ width: 72 }} />)}
            </colgroup>
            <thead>
              <tr className="bg-white sticky top-0 z-10 shadow-sm">
                <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 bg-white sticky left-0 z-20">
                  {t('roomgrid.roomCol')}
                </th>
                {dates.map(d => {
                  const dt = new Date(d + 'T00:00:00')
                  const isToday = d === today
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6
                  return (
                    <th key={d} className={`border border-gray-200 px-1 py-1.5 text-center font-medium
                      ${isToday ? 'bg-indigo-50 text-indigo-700' : isWeekend ? 'bg-amber-50 text-amber-700' : 'text-gray-600'}`}>
                      <div>{d.slice(5)}</div>
                      <div className="text-gray-400 font-normal">{dayLabels[dt.getDay()]}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.properties.map(prop => (
                <tr key={prop.id} className="hover:bg-gray-50/50">
                  <td className="border border-gray-200 px-2 py-2 font-medium text-gray-800 bg-white sticky left-0 z-10 whitespace-nowrap overflow-hidden text-ellipsis">
                    <div>{prop.name}</div>
                    {prop.room_count > 1 && (
                      <div className="text-gray-400 font-normal">{t('roomgrid.roomsUnit', { count: prop.room_count })}</div>
                    )}
                  </td>
                  {dates.map(date => {
                    const state = cellState(prop.id, date)
                    const bk    = state === 'booked' ? getBooking(prop.id, date) : null
                    const sel   = isSelected(prop.id, date)
                    const isFirstDay = bk ? bk.check_in === date : false

                    const isDropTarget = state === 'available' && !!dragBk
                    let cellCls = 'border border-gray-200 px-1 py-1 text-center cursor-pointer transition-colors select-none h-12 align-top '
                    if (sel)             cellCls += 'ring-2 ring-indigo-500 ring-inset '
                    if (state === 'booked')   cellCls += 'bg-cyan-100 '
                    else if (state === 'blocked') cellCls += 'bg-gray-200 '
                    else                          cellCls += isDropTarget ? 'bg-emerald-50 hover:bg-emerald-100 ' : 'hover:bg-indigo-50 '

                    return (
                      <td key={date} className={cellCls}
                        onClick={() => toggleCell(prop.id, date, state)}
                        onDragOver={isDropTarget ? (e => e.preventDefault()) : undefined}
                        onDrop={isDropTarget ? (() => { if (dragBk) moveBooking(dragBk, prop.id, date); setDragBk(null) }) : undefined}>
                        {state === 'booked' && bk ? (
                          isFirstDay ? (
                            <Link href={`/booking/bookings/${bk.id}`}
                              draggable
                              onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragBk(bk) }}
                              onDragEnd={() => setDragBk(null)}
                              onClick={e => e.stopPropagation()}
                              className="block truncate text-cyan-800 font-medium text-xs leading-tight hover:underline px-0.5 cursor-move"
                              title={t('roomgrid.dragTitle')}>
                              {bk.guest_name ?? '—'}
                            </Link>
                          ) : null
                        ) : state === 'blocked' ? (
                          <Lock className="h-3 w-3 text-gray-400 mx-auto mt-2" />
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {prop.base_price ? `${prop.base_price}` : ''}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom action bar */}
      {selected.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-t shadow-lg">
          <button onClick={clearSelection}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">×</button>
          <span className="text-sm font-medium text-gray-700">
            {t('roomgrid.selectedCount', { count: selected.length })}
          </span>

          <div className="flex gap-2 ml-auto">
            {selectedGroups.length > 0 && (
              <Link href={`/booking/bookings${bookingQueryStr}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> {t('roomgrid.fillBooking')}
              </Link>
            )}
            {selectionHasAvailable && (
              <button onClick={blockSelected} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                <Lock className="h-4 w-4" /> {t('roomgrid.closeBooking')}
              </button>
            )}
            {selectionHasBlocked && (
              <button onClick={unblockSelected} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                <Unlock className="h-4 w-4" /> {t('roomgrid.openBooking')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {msg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {msg}
        </div>
      )}
    </div>
  )
}
