'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle, XCircle, Clock, Trash2, ExternalLink } from 'lucide-react'

interface PubBooking {
  id: string; confirmation_code: string; guest_name: string; guest_email: string
  guest_phone: string | null; num_guests: number; check_in: string; check_out: string
  total_price: number | null; promo_code: string | null; promo_discount: number | null
  property_id: string | null; notes: string | null; status: 'pending' | 'confirmed' | 'cancelled'; created_at: string
  converted_booking_id?: string | null
  properties?: { name: string } | null
}

const STATUS_META = {
  pending:   { color: 'text-amber-600 bg-amber-50',   icon: Clock },
  confirmed: { color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle },
  cancelled: { color: 'text-gray-500 bg-gray-100',    icon: XCircle },
}

function nights(ci: string, co: string) {
  return Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}

export default function PublicBookingsPage() {
  const t = useTranslations('Booking')
  const locale = useLocale()
  const STATUS = {
    pending:   { label: t('status.pending'),   ...STATUS_META.pending },
    confirmed: { label: t('status.confirmed'), ...STATUS_META.confirmed },
    cancelled: { label: t('status.cancelled'), ...STATUS_META.cancelled },
  }
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })
  const fmt = (n: number) => n.toLocaleString(locale)
  const [bookings, setBookings] = useState<PubBooking[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter]     = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [busy, setBusy]         = useState<string | null>(null)
  const [flash, setFlash]       = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/booking/public-bookings')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setBookings(d.bookings ?? []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  function notify(ok: boolean, text: string) {
    setFlash({ ok, text })
    setTimeout(() => setFlash(null), 4000)
  }

  // 確認 / 拒絕（單一後端動作：確認＝轉正式訂單＋寄信；拒絕＝取消＋寄婉拒信）
  async function decide(b: PubBooking, action: 'confirm' | 'reject') {
    setBusy(b.id)
    try {
      const res = await fetch('/api/booking/public-bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, action }),
      })
      const d = await res.json()
      if (!res.ok) { notify(false, d.error ?? t('public.actionFailed')); return }
      setBookings(prev => prev.map(x => x.id === b.id
        ? { ...x, status: action === 'confirm' ? 'confirmed' : 'cancelled', converted_booking_id: d.booking_id ?? x.converted_booking_id }
        : x))
      if (action === 'confirm') {
        notify(true, d.emailed ? t('public.confirmedEmailed') : t('public.confirmedNoEmail'))
      } else {
        notify(true, d.emailed ? t('public.rejectedEmailed') : t('public.rejectedNoEmail'))
      }
    } catch {
      notify(false, t('bookings.toast.networkError'))
    } finally { setBusy(null) }
  }

  // 取消已確認 / 恢復待確認（僅改狀態，不轉單不寄信）
  async function setStatus(b: PubBooking, status: 'cancelled' | 'pending') {
    setBusy(b.id)
    try {
      const res = await fetch('/api/booking/public-bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, status }),
      })
      const d = await res.json()
      if (!res.ok || !d.booking) { notify(false, d.error ?? t('public.actionFailed')); return }
      setBookings(prev => prev.map(x => x.id === b.id ? d.booking : x))
    } catch {
      notify(false, t('bookings.toast.networkError'))
    } finally { setBusy(null) }
  }

  async function remove(b: PubBooking) {
    if (!window.confirm(t('public.deleteConfirm', { name: b.guest_name }))) return
    setBusy(b.id)
    try {
      const res = await fetch('/api/booking/public-bookings', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id }),
      })
      if (!res.ok) { const d = await res.json(); notify(false, d.error ?? t('bookings.toast.deleteFailed')); return }
      setBookings(prev => prev.filter(x => x.id !== b.id))
    } catch {
      notify(false, t('bookings.toast.networkError'))
    } finally { setBusy(null) }
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  return (
    <div className="p-4 md:p-6 pb-16 max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('public.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('public.subtitle')}</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {t('public.pendingCount', { count: bookings.filter(b => b.status === 'pending').length })}
        </span>
      </div>

      {flash && (
        <div className={`text-sm rounded-lg px-3 py-2 ${flash.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
          {flash.text}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {(['all','pending','confirmed','cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? `${t('public.all')} (${bookings.length})` : `${STATUS[s].label} (${bookings.filter(b => b.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">{t('common.loading')}</div>
      ) : loadError ? (
        <div className="text-center py-20 text-rose-500 text-sm">
          {t('public.loadError')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">{t('public.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const st = STATUS[b.status]
            const Icon = st.icon
            const n = nights(b.check_in, b.check_out)
            const isBusy = busy === b.id
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
                      {b.promo_discount && <div className="text-xs text-emerald-600">{t('public.discount', { amount: fmt(b.promo_discount) })}</div>}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                  <span className="flex items-center gap-1">
                    📅 {fmtDate(b.check_in)} → {fmtDate(b.check_out)}（{t('detail.nights', { nights: n })}）
                  </span>
                  <span>👥 {t('public.persons', { count: b.num_guests })}</span>
                  {b.properties?.name && <span>🏠 {b.properties.name}</span>}
                  {b.status === 'confirmed' && b.converted_booking_id && (
                    <span className="text-xs text-emerald-600">{t('public.convertedOrder')}</span>
                  )}
                </div>

                {b.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{b.notes}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {b.status === 'pending' && (
                    <>
                      <button onClick={() => decide(b, 'confirm')} disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                        <CheckCircle className="h-3.5 w-3.5" /> {isBusy ? t('public.processing') : t('public.confirmBooking')}
                      </button>
                      <button onClick={() => decide(b, 'reject')} disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-rose-500 border-rose-200 hover:bg-rose-50 disabled:opacity-50">
                        <XCircle className="h-3.5 w-3.5" /> {t('public.reject')}
                      </button>
                    </>
                  )}
                  {b.status === 'confirmed' && (
                    <button onClick={() => setStatus(b, 'cancelled')} disabled={isBusy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                      {t('public.cancelBooking')}
                    </button>
                  )}
                  {b.status === 'cancelled' && (
                    <button onClick={() => setStatus(b, 'pending')} disabled={isBusy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                      {t('public.restorePending')}
                    </button>
                  )}
                  <a href={`mailto:${b.guest_email}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                    <ExternalLink className="h-3.5 w-3.5" /> {t('public.sendEmail')}
                  </a>
                  <button onClick={() => remove(b)} disabled={isBusy} className="ml-auto p-1.5 rounded-lg border text-rose-400 hover:bg-rose-50 disabled:opacity-50">
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
