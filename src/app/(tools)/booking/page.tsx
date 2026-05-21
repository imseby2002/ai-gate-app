'use client'
import { useEffect, useState } from 'react'
import { CalendarDays, Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string; guest_name: string; check_in: string; check_out: string
  status: string; platform: string; properties?: { name: string }
}

const PLATFORM_COLORS: Record<string, string> = {
  booking_com: 'bg-blue-100 text-blue-800',
  agoda:       'bg-purple-100 text-purple-800',
  airbnb:      'bg-red-100 text-red-800',
  trip_com:    'bg-cyan-100 text-cyan-800',
  asiayo:      'bg-orange-100 text-orange-800',
  manual:      'bg-gray-100 text-gray-700',
  direct:      'bg-green-100 text-green-800',
}
const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}

export default function BookingDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  useEffect(() => {
    fetch(`/api/booking/bookings?from=${today}&to=${in7}&limit=200`)
      .then(r => r.json()).then(d => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false))
  }, [today, in7])

  const checkingInToday  = bookings.filter(b => b.check_in === today && b.status === 'confirmed')
  const checkingOutToday = bookings.filter(b => b.check_out === today && b.status === 'confirmed')
  const upcoming = bookings.filter(b => b.check_in > today && b.check_in <= in7 && b.status === 'confirmed')

  const stats = [
    { label: '今日入住',  value: checkingInToday.length,                           icon: Users,        color: 'bg-green-50 text-green-700 border-green-200' },
    { label: '今日退房',  value: checkingOutToday.length,                          icon: CheckCircle2, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: '7天內入住', value: upcoming.length,                                   icon: CalendarDays, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: '待確認',    value: bookings.filter(b => b.status === 'pending').length, icon: AlertCircle,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">訂房總覽</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className="text-3xl font-bold">{loading ? '…' : s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Today check-ins */}
      {checkingInToday.length > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-800">今日入住</h2>
          <div className="space-y-2">
            {checkingInToday.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{b.guest_name || '(未知旅客)'}</div>
                  <div className="text-xs text-gray-500">{b.properties?.name} · 退房 {b.check_out}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PLATFORM_COLORS[b.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PLATFORM_NAMES[b.platform] ?? b.platform}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming 7 days */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-800">未來 7 天訂單</h2>
          <Link href="/booking/bookings" className="text-xs text-indigo-600 hover:underline">查看全部</Link>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 py-4 text-center">載入中…</div>
        ) : upcoming.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">未來 7 天無新訂單</div>
        ) : (
          <div className="divide-y">
            {upcoming.slice(0, 10).map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{b.guest_name || '(未知旅客)'}</div>
                  <div className="text-xs text-gray-500 truncate">{b.properties?.name} · {b.check_in} → {b.check_out}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PLATFORM_COLORS[b.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PLATFORM_NAMES[b.platform] ?? b.platform}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
