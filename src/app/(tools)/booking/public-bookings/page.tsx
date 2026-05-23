'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Trash2, ExternalLink, ArrowRightCircle } from 'lucide-react'

interface PubBooking {
  id: string; confirmation_code: string; guest_name: string; guest_email: string
  guest_phone: string | null; num_guests: number; check_in: string; check_out: string
  total_price: number | null; promo_code: string | null; promo_discount: number | null
  notes: string | null; status: 'pending' | 'confirmed' | 'cancelled'; created_at: string
  properties?: { name: string } | null
}

const STATUS = {
  pending:   { label: '待確認', color: 'text-amber-600 bg-amber-50',   icon: Clock },
  confirmed: { label: '已確認', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'text-gray-500 bg-gray-100',    icon: XCircle },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}
function nights(ci: string, co: string) {
  return Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}
function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function PublicBookingsPage() {
  const [bookings, setBookings] = useState<PubBooking[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [converting, setConverting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/booking/public-bookings').then(r => r.json())
      .then(d => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/booking/public-bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const d = await res.json()
    if (d.booking) setBookings(prev => prev.map(b => b.id === id ? d.booking : b))
  }

  async function convertToBooking(b: PubBooking) {
    if (!confirm(`將「${b.guest_name}」的訂單轉入正式訂單？`)) return
    setConverting(b.id)
    try {
      const body = {
        guest_name: b.guest_name, guest_email: b.guest_email, guest_phone: b.guest_phone ?? '',
        check_in: b.check_in, check_out: b.check_out, num_guests: b.num_guests,
        total_price: b.total_price ?? 0, property_id: b.property_id ?? '',
        platform: 'direct', status: 'confirmed', notes: b.notes ?? '',
        promo_code: b.promo_code ?? '', promo_discount: b.promo_discount ?? 0,
      }
      const res = await fetch('/api/booking/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await updateStatus(b.id, 'confirmed')
        alert('已轉入正式訂單')
      } else {
        const d = await res.json()
        alert(d.error ?? '轉換失敗')
      }
    } finally { setConverting(null) }
  }

  async function remove(id: string) {
    if (!confirm('確定刪除此訂單？')) return
    await fetch('/api/booking/public-bookings', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setBookings(prev => prev.filter(b => b.id !== id))
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  return (
    <div className="p-4 md:p-6 pb-16 max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">線上訂房申請</h1>
          <p className="text-sm text-gray-500 mt-0.5">旅客透過前台頁面提交的訂房申請</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          共 {bookings.filter(b => b.status === 'pending').length} 筆待確認
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['all','pending','confirmed','cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? `全部 (${bookings.length})` : `${STATUS[s].label} (${bookings.filter(b => b.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">尚無訂房申請</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const st = STATUS[b.status]
            const Icon = st.icon
            const n = nights(b.check_in, b.check_out)
            return (
              <div key={b.id} className={`bg-white rounded-xl border p-4 space-y-3 ${b.status === 'pending' ? 'border-amber-200' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{b.guest_name}</span>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                        <Icon className="h-3 w-3" />{st.label}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">#{b.confirmation_code}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                      <span>{b.guest_email}</span>
                      {b.guest_phone && <span>{b.guest_phone}</span>}
                    </div>
                  </div>
                  {b.total_price && (
                    <div className="text-right">
                      <div className="font-bold text-gray-900">NT$ {fmt(b.total_price)}</div>
                      {b.promo_discount && <div className="text-xs text-emerald-600">折 NT$ {fmt(b.promo_discount)}</div>}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                  <span className="flex items-center gap-1">
                    📅 {fmtDate(b.check_in)} → {fmtDate(b.check_out)}（{n} 晚）
                  </span>
                  <span>👥 {b.num_guests} 人</span>
                  {b.properties?.name && <span>🏠 {b.properties.name}</span>}
                </div>

                {b.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{b.notes}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {b.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(b.id, 'confirmed')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" /> 確認訂房
                      </button>
                      <button onClick={() => updateStatus(b.id, 'cancelled')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-rose-500 border-rose-200 hover:bg-rose-50">
                        <XCircle className="h-3.5 w-3.5" /> 拒絕
                      </button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <button onClick={() => updateStatus(b.id, 'cancelled')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-gray-500 hover:bg-gray-50">
                      取消訂房
                    </button>
                  )}
                  {b.status === 'cancelled' && (
                    <button onClick={() => updateStatus(b.id, 'pending')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-gray-500 hover:bg-gray-50">
                      恢復待確認
                    </button>
                  )}
                  <button onClick={() => convertToBooking(b)} disabled={converting === b.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-purple-600 border-purple-200 hover:bg-purple-50 disabled:opacity-50">
                    <ArrowRightCircle className="h-3.5 w-3.5" /> {converting === b.id ? '轉換中…' : '轉正式訂單'}
                  </button>
                  <a href={`mailto:${b.guest_email}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                    <ExternalLink className="h-3.5 w-3.5" /> 寄信
                  </a>
                  <button onClick={() => remove(b.id)} className="ml-auto p-1.5 rounded-lg border text-rose-400 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
