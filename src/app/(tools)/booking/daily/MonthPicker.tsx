'use client'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 每日入住左側的月曆（參考 TRAIWAN 日曆式訂房）：每天顯示「空房/總房數」，沒空房顯示「客滿」，
// 點日期切換右側當日入住表。空房計算與「日曆訂房」相同：每個房型 房間數 − 當晚訂單數，已關房的房型算 0。

interface Booking { property_id: string | null; check_in: string; check_out: string; status: string }
interface Property { id: string; room_count: number }

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

export default function MonthPicker({ date, onSelect, today }: { date: string; onSelect: (d: string) => void; today: string }) {
  const t = useTranslations('Booking')
  const locale = useLocale()
  const [year, setYear] = useState(Number(date.slice(0, 4)))
  const [month, setMonth] = useState(Number(date.slice(5, 7)) - 1)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [blocked, setBlocked] = useState<Set<string>>(new Set())

  // 選到其他月份的日期（例如用上一天/下一天跨月）時，月曆跟著切過去
  useEffect(() => {
    setYear(Number(date.slice(0, 4)))
    setMonth(Number(date.slice(5, 7)) - 1)
  }, [date])

  useEffect(() => {
    const days = new Date(year, month + 1, 0).getDate()
    const from = ymd(year, month, 1), to = ymd(year, month, days)
    let cancelled = false
    Promise.all([
      fetch(`/api/booking/bookings?from=${from}&to=${to}&limit=500`).then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
      fetch(`/api/booking/blocked?from=${from}&to=${to}`).then(r => r.json()),
    ]).then(([bk, pr, bl]) => {
      if (cancelled) return
      setBookings(bk.bookings ?? [])
      setProperties((pr.properties ?? []).filter((p: Property) => p.room_count > 0))
      setBlocked(new Set((bl.blocked ?? []).map((b: { property_id: string; date: string }) => `${b.property_id}|${b.date}`)))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [year, month])

  const totalRooms = properties.reduce((s, p) => s + p.room_count, 0)
  const bookedByDate: Record<string, Record<string, number>> = {}
  for (const b of bookings) {
    if (b.status === 'cancelled' || !b.property_id) continue
    const cur = new Date(b.check_in + 'T00:00:00')
    const end = new Date(b.check_out + 'T00:00:00')
    while (cur < end) {
      const ds = ymd(cur.getFullYear(), cur.getMonth(), cur.getDate())
      ;(bookedByDate[ds] ??= {})[b.property_id] = (bookedByDate[ds]?.[b.property_id] ?? 0) + 1
      cur.setDate(cur.getDate() + 1)
    }
  }
  function available(ds: string) {
    return properties.reduce((s, p) =>
      blocked.has(`${p.id}|${ds}`) ? s : s + Math.max(0, p.room_count - (bookedByDate[ds]?.[p.id] ?? 0)), 0)
  }

  const days = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // 週一開頭
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const prev = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1)
  const next = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1)
  const title = new Date(year, month, 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
  const dowLabels = [1, 2, 3, 4, 5, 6, 0].map(d => t(`roomgrid.day.${d}`))

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-400 mb-1">
        {dowLabels.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />
          const ds = ymd(year, month, d)
          const av = totalRooms ? available(ds) : null
          const full = av === 0
          const sel = ds === date
          return (
            <button key={i} onClick={() => onSelect(ds)}
              className={`rounded-lg py-1 leading-tight transition-colors ${sel ? 'bg-sky-500 text-white' : 'hover:bg-sky-50'}`}>
              <div className={`text-sm font-semibold ${sel ? '' : ds === today ? 'text-sky-600 underline' : 'text-sky-700'}`}>{d}</div>
              {av != null && (
                <div className={`text-[10px] ${sel ? 'text-white' : full ? 'text-red-500 font-semibold' : 'text-red-400'}`}>
                  {full ? t('calendar.full') : `${av}/${totalRooms}`}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
