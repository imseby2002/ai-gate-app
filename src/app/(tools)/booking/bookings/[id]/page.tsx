'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Printer, Save, X, Trash2 } from 'lucide-react'

interface Booking {
  id: string; platform: string; platform_booking_id: string
  guest_name: string; guest_email: string; guest_phone: string
  guest_gender: string; guest_birthday: string; guest_id_number: string; guest_address: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  payment_type: string; arrival_time: string
  deposit_amount: number | null; is_paid: boolean
  special_requests: string; notes: string; source: string
  created_at: string; updated_at: string
  properties: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
  no_show:   'bg-orange-100 text-orange-700',
}

export default function BookingDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const t         = useTranslations('Booking')
  const locale    = useLocale()
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    confirmed: { label: t('status.confirmed'), color: STATUS_COLORS.confirmed },
    pending:   { label: t('status.pending'),   color: STATUS_COLORS.pending },
    cancelled: { label: t('status.cancelled'), color: STATUS_COLORS.cancelled },
    completed: { label: t('status.completed'), color: STATUS_COLORS.completed },
    no_show:   { label: t('status.no_show'),   color: STATUS_COLORS.no_show },
  }
  const PLATFORM_NAMES: Record<string, string> = {
    booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
    trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
    manual: t('platform.manual'), direct: t('platform.direct'),
  }
  const PAYMENT_LABELS: Record<string, string> = {
    channel: t('payment.channel'), direct: t('payment.direct'), unpaid: t('payment.unpaid'),
  }
  const [bk, setBk]       = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm]   = useState<Partial<Booking>>({})
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/booking/bookings/${id}`)
      .then(r => r.json())
      .then(d => { setBk(d.booking); setForm(d.booking ?? {}) })
      .finally(() => setLoading(false))
  }, [id])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      const d = await res.json()
      if (d.booking) { setBk(d.booking); setForm(d.booking); setEditing(false) }
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!window.confirm(t('bookings.toast.deleteConfirm'))) return
    setDeleting(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { setDeleting(false); return }
      router.push('/booking/bookings')
    } catch { setDeleting(false) }
  }

  function fi(label: string, key: keyof Booking, type: string = 'text') {
    const val = (form[key] ?? '') as string
    return (
      <div className="space-y-0.5">
        <div className="text-xs text-gray-400">{label}</div>
        {editing ? (
          <input type={type} value={val}
            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        ) : (
          <div className="text-sm text-gray-900">{(bk as unknown as Record<string, unknown>)?.[key] as string || '—'}</div>
        )}
      </div>
    )
  }

  function nights() {
    if (!bk) return 0
    const ci = new Date(bk.check_in); const co = new Date(bk.check_out)
    return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
  }

  if (loading) return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>
  if (!bk) return <div className="p-8 text-center text-gray-400">{t('detail.notFound')}</div>

  const st = STATUS_MAP[bk.status] ?? { label: bk.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-6 pb-16 max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{t('detail.title')}</h1>
          <div className="text-xs text-gray-400">
            {bk.platform_booking_id ? t('detail.confirmCode', { code: bk.platform_booking_id }) : t('detail.idLabel', { id: bk.id.slice(0, 8) })}
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Printer className="h-4 w-4" /> {t('detail.print')}
        </button>
        <button onClick={remove} disabled={deleting} title={t('bookings.deleteTitle')}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-rose-500 hover:bg-rose-50 disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> {t('bookings.delete')}
        </button>
        {editing ? (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" /> {t('bookings.form.cancel')}
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? t('bookings.form.saving') : t('detail.save')}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Edit2 className="h-4 w-4" /> {t('detail.edit')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.orderInfo')}</h2>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.source')}</div>
            <div className="text-sm font-medium text-gray-900">{PLATFORM_NAMES[bk.platform] ?? bk.platform}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.room')}</div>
            <div className="text-sm text-gray-900">{bk.properties?.name ?? '—'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.checkIn')}</div>
              {editing ? (
                <input type="date" value={form.check_in ?? ''}
                  onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{bk.check_in}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.checkOut')}</div>
              {editing ? (
                <input type="date" value={form.check_out ?? ''}
                  onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{bk.check_out} <span className="text-gray-400">({t('detail.nights', { nights: nights() })})</span></div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.numGuests')}</div>
              {editing ? (
                <input type="number" min={1} value={form.num_guests ?? 1}
                  onChange={e => setForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{t('detail.guestsUnit', { count: bk.num_guests })}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.amount')}</div>
              {editing ? (
                <input type="number" value={form.total_price ?? ''}
                  onChange={e => setForm(p => ({ ...p, total_price: parseFloat(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">
                  {bk.total_price ? `${bk.currency} ${Number(bk.total_price).toLocaleString()}` : '—'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.paymentMethod')}</div>
            {editing ? (
              <select value={form.payment_type ?? 'channel'}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <div className="text-sm text-gray-900">{PAYMENT_LABELS[bk.payment_type] ?? t('payment.channel')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.deposit')}</div>
              {editing ? (
                <input type="number" value={form.deposit_amount ?? ''}
                  onChange={e => setForm(p => ({ ...p, deposit_amount: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">
                  {bk.deposit_amount != null ? `${bk.currency} ${Number(bk.deposit_amount).toLocaleString()}` : '—'}
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.isPaid')}</div>
              {editing ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 h-[34px]">
                  <input type="checkbox" checked={!!form.is_paid}
                    onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-300" />
                  {t('detail.isPaid')}
                </label>
              ) : (
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${bk.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {bk.is_paid ? t('detail.paidYes') : t('detail.paidNo')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.orderStatus')}</div>
            {editing ? (
              <select value={form.status ?? 'confirmed'}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
            )}
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.bookedAt')}</div>
            <div className="text-sm text-gray-900">{new Date(bk.created_at).toLocaleString(locale)}</div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.guestInfo')}</h2>
          {fi(t('detail.name'), 'guest_name')}
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.gender')}</div>
            {editing ? (
              <select value={(form.guest_gender ?? '') as string}
                onChange={e => setForm(p => ({ ...p, guest_gender: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">{t('detail.genderNone')}</option>
                <option value="male">{t('gender.male')}</option>
                <option value="female">{t('gender.female')}</option>
                <option value="other">{t('gender.other')}</option>
              </select>
            ) : (
              <div className="text-sm text-gray-900">
                {{ male: t('gender.male'), female: t('gender.female'), other: t('gender.other') }[bk.guest_gender] ?? '—'}
              </div>
            )}
          </div>
          {fi(t('detail.phone'), 'guest_phone', 'tel')}
          {fi(t('detail.email'), 'guest_email', 'email')}
          {fi(t('detail.birthday'), 'guest_birthday', 'date')}
          {fi(t('detail.idNumber'), 'guest_id_number')}
          {fi(t('detail.address'), 'guest_address')}
          {fi(t('detail.arrivalTime'), 'arrival_time')}
        </div>
      </div>

      {/* Notes & Requests */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.notesSection')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.specialRequests')}</div>
            {editing ? (
              <textarea value={(form.special_requests ?? '') as string} rows={4}
                onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{bk.special_requests || '—'}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.internalNotes')}</div>
            {editing ? (
              <textarea value={(form.notes ?? '') as string} rows={4}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{bk.notes || '—'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
