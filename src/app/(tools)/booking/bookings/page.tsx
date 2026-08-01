'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createPortal } from 'react-dom'
import { Plus, Search, Filter, Download, ChevronDown, ChevronUp, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string; guest_name: string; guest_email: string; guest_phone: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  platform: string; platform_booking_id: string; notes: string
  properties?: { name: string }; created_at: string
}
interface Property { id: string; name: string }
interface AddonService { id: string; name: string; enabled: boolean; price: number; unit: string; note: string }
interface ProfileExtras { breakfast: { type: string; price_per_person: number }; addon_services: AddonService[] }

function addDays(iso: string, n: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
  no_show:   'bg-orange-100 text-orange-700',
}

export default function BookingsPage() {
  const t = useTranslations('Booking')
  const locale = useLocale()
  const router = useRouter()
  const prefillConsumed = useRef(false)
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
  const [bookings, setBookings]       = useState<Booking[]>([])
  const [properties, setProperties]   = useState<Property[]>([])
  const [profileExtras, setProfileExtras] = useState<ProfileExtras | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterProp, setFilterProp]         = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding]           = useState(false)
  const [sortKey, setSortKey]         = useState<'check_in' | 'created_at'>('check_in')
  const [sortDesc, setSortDesc]       = useState(true)
  const [form, setForm] = useState({
    property_id: '', guest_name: '', guest_email: '', guest_phone: '',
    check_in: '', check_out: '', num_guests: 1,
    total_price: '', currency: 'TWD', status: 'confirmed',
    platform: 'direct', notes: '', special_requests: '',
    extras: { breakfast: false, services: [] as string[] },
  })
  const [saving, setSaving] = useState(false)
  const [sendingNotif, setSendingNotif] = useState<string | null>(null)
  const [promoInput, setPromoInput]   = useState('')
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discount?: number; name?: string; error?: string } | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)

  function notify(ok: boolean, text: string) {
    setFlash({ ok, text })
    setTimeout(() => setFlash(null), 4000)
  }

  useEffect(() => {
    const params = new URLSearchParams({ limit: '500' })
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo)   params.set('to', filterTo)
    if (filterStatus) params.set('status', filterStatus)
    if (filterProp)   params.set('property_id', filterProp)
    setLoading(true)
    Promise.all([
      fetch(`/api/booking/bookings?${params}`).then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
      fetch('/api/booking/profile').then(r => r.json()),
    ]).then(([bk, pr, pf]) => {
      setBookings(bk.bookings ?? [])
      setProperties(pr.properties ?? [])
      if (pf.profile) setProfileExtras({ breakfast: pf.profile.breakfast ?? { type: 'none', price_per_person: 0 }, addon_services: pf.profile.addon_services ?? [] })
    }).finally(() => setLoading(false))
  }, [filterStatus, filterProp, filterFrom, filterTo])

  // 從空房表/日曆/每日入住帶入的預填參數 → 自動開啟新增視窗並填好房型與日期。
  // room_name（每日入住只知道房型名稱，不是 id）需等 properties 載入後才能解析成 property_id；
  // 用 ref 確保只消費一次，並把參數從網址清掉，避免之後 properties 陣列因篩選重新整理
  // （新的陣列參照）而重新觸發、把使用者已經關掉的新增視窗又跳出來。
  useEffect(() => {
    if (prefillConsumed.current) return
    const sp = new URLSearchParams(window.location.search)
    const pid = sp.get('property_id')
    const roomName = sp.get('room_name')
    const dateParam = sp.get('date')
    const guestName = sp.get('guest_name')
    if (!pid && !roomName) return
    if (roomName && properties.length === 0) return // 等 properties 載入
    prefillConsumed.current = true
    const resolvedPid = pid || (roomName ? properties.find(p => p.name === roomName)?.id ?? '' : '')
    setForm(f => ({
      ...f,
      property_id: resolvedPid,
      check_in: sp.get('check_in') ?? dateParam ?? '',
      check_out: sp.get('check_out') ?? (dateParam ? addDays(dateParam, 1) : ''),
      guest_name: guestName ?? f.guest_name,
    }))
    setAdding(true)
    router.replace(window.location.pathname)
  }, [properties, router])

  const filtered = bookings.filter(b => {
    if (filterPlatform && b.platform !== filterPlatform) return false
    if (search) {
      const q = search.toLowerCase()
      return (b.guest_name ?? '').toLowerCase().includes(q)
        || (b.guest_phone ?? '').includes(q)
        || (b.guest_email ?? '').toLowerCase().includes(q)
        || (b.platform_booking_id ?? '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(true) }
  }
  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return null
    return sortDesc ? <ChevronDown className="h-3 w-3 inline ml-0.5" /> : <ChevronUp className="h-3 w-3 inline ml-0.5" />
  }

  function exportCSV() {
    const rows = [
      [t('bookings.csv.guest'),t('bookings.csv.phone'),t('bookings.csv.room'),t('bookings.csv.checkIn'),t('bookings.csv.checkOut'),t('bookings.csv.guests'),t('bookings.csv.amount'),t('bookings.csv.source'),t('bookings.csv.confirmCode'),t('bookings.csv.status'),t('bookings.csv.created')],
      ...filtered.map(b => [
        b.guest_name, b.guest_phone, b.properties?.name ?? '', b.check_in, b.check_out,
        b.num_guests, b.total_price ?? '', PLATFORM_NAMES[b.platform] ?? b.platform,
        b.platform_booking_id ?? '', STATUS_MAP[b.status]?.label ?? b.status,
        new Date(b.created_at).toLocaleDateString(locale),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = t('bookings.csv.filename'); a.click()
    URL.revokeObjectURL(url)
  }

  async function sendConfirmation(bookingId: string) {
    setSendingNotif(bookingId)
    try {
      const res = await fetch('/api/booking/notifications/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, type: 'confirmation' }),
      })
      const d = await res.json()
      if (d.ok) notify(true, t('bookings.toast.confirmSentTo', { to: d.sent_to }))
      else notify(false, d.error ?? t('bookings.toast.sendFailed'))
    } finally { setSendingNotif(null) }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/booking/bookings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) { notify(false, t('bookings.toast.statusUpdateFailed')); return }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
  }

  async function removeBooking(id: string) {
    if (!window.confirm(t('bookings.toast.deleteConfirm'))) return
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { const d = await res.json(); notify(false, d.error ?? t('bookings.toast.deleteFailed')); return }
      setBookings(prev => prev.filter(b => b.id !== id))
      notify(true, t('bookings.toast.deleted'))
    } catch { notify(false, t('bookings.toast.networkError')) }
  }

  async function checkPromo() {
    if (!promoInput) return
    setPromoChecking(true)
    const nights = form.check_in && form.check_out
      ? Math.max(1, Math.ceil((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000))
      : 1
    const res = await fetch('/api/booking/promos/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: promoInput, num_nights: nights, total_price: parseFloat(form.total_price) || 0 }),
    })
    const d = await res.json()
    setPromoResult(d)
    if (d.valid) setForm(f => ({ ...f, extras: { ...f.extras } }))
    setPromoChecking(false)
  }

  async function save() {
    setSaving(true)
    try {
      const promo_code = promoResult?.valid ? promoInput.toUpperCase() : null
      const promo_discount = promoResult?.valid ? promoResult.discount : null
      const res = await fetch('/api/booking/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, total_price: form.total_price ? parseFloat(form.total_price) : null, promo_code, promo_discount }),
      })
      const d = await res.json()
      if (d.booking) {
        setBookings(prev => [d.booking, ...prev])
        setAdding(false)
        setPromoInput(''); setPromoResult(null)
        setForm({ property_id: '', guest_name: '', guest_email: '', guest_phone: '', check_in: '', check_out: '', num_guests: 1, total_price: '', currency: 'TWD', status: 'confirmed', platform: 'direct', notes: '', special_requests: '', extras: { breakfast: false, services: [] } })
        notify(true, t('bookings.toast.added'))
      } else notify(false, d.error ?? t('bookings.toast.addFailed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="p-4 md:p-6 pb-16 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">{t('bookings.title')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-white text-sm text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('bookings.export')}</span>
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('bookings.addManual')}</span>
            <span className="sm:hidden">{t('bookings.add')}</span>
          </button>
        </div>
      </div>

      {flash && (
        <div className={`text-sm rounded-lg px-3 py-2 ${flash.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
          {flash.text}
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 bg-white text-sm flex-1 min-w-0">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('bookings.searchPlaceholder')}
              className="flex-1 outline-none text-sm min-w-0" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-2 py-1.5 bg-white text-sm focus:outline-none">
            <option value="">{t('bookings.allStatus')}</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {properties.length > 0 && (
            <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
              className="border rounded-lg px-2 py-1.5 bg-white text-sm focus:outline-none hidden sm:block">
              <option value="">{t('bookings.allProperties')}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('bookings.advanced')}</span>
          </button>
          <span className="flex items-center text-xs text-gray-400 px-1">{t('bookings.count', { count: filtered.length })}</span>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap p-3 bg-gray-50 rounded-xl border">
            {properties.length > 0 && (
              <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
                className="sm:hidden border rounded-lg px-2.5 py-1 bg-white text-sm focus:outline-none">
                <option value="">{t('bookings.allProperties')}</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
              <span className="text-xs whitespace-nowrap text-gray-500">{t('bookings.checkInDate')}</span>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="border rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 min-w-0" />
              <span className="text-xs text-gray-500">{t('bookings.to')}</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="border rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 min-w-0" />
            </div>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
              className="border rounded-lg px-2.5 py-1 bg-white text-sm focus:outline-none">
              <option value="">{t('bookings.allPlatforms')}</option>
              {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterPlatform(''); setSearch(''); setFilterStatus(''); setFilterProp('') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">{t('bookings.clearFilters')}</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('bookings.noMatch')}</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(b => {
              const st = STATUS_MAP[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={b.id} className="bg-white rounded-xl border p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/booking/bookings/${b.id}`}
                        className="font-semibold text-indigo-600 block truncate">{b.guest_name || t('bookings.noName')}</Link>
                      {b.guest_phone && <div className="text-xs text-gray-400 mt-0.5">{b.guest_phone}</div>}
                    </div>
                    <select value={b.status} onChange={e => updateStatus(b.id, e.target.value)}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium border-0 shrink-0 ${st.color}`}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-gray-500">{b.properties?.name || '—'}</div>
                    <div className="text-gray-700 text-right font-medium">
                      {b.total_price ? `NT$ ${Number(b.total_price).toLocaleString()}` : '—'}
                    </div>
                    <div className="text-gray-500">{t('bookings.checkInPrefix')} {b.check_in}</div>
                    <div className="text-gray-500 text-right">{t('bookings.checkOutPrefix')} {b.check_out}</div>
                    <div className="text-gray-400">{PLATFORM_NAMES[b.platform] ?? b.platform} · {t('bookings.guestsCount', { count: b.num_guests })}</div>
                    {b.notes && <div className="text-amber-600 text-right truncate" title={b.notes}>⚠ {b.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t">
                    {b.guest_email && (
                      <button onClick={() => sendConfirmation(b.id)} disabled={sendingNotif === b.id}
                        className="flex items-center gap-1 text-xs text-indigo-600 disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" /> {t('bookings.confirmationLetter')}
                      </button>
                    )}
                    <button onClick={() => removeBooking(b.id)}
                      className="flex items-center gap-1 text-xs text-rose-500 ml-auto">
                      <Trash2 className="h-3.5 w-3.5" /> {t('bookings.delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.guest')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.room')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('check_in')}>
                    {t('bookings.col.checkIn')} <SortIcon k="check_in" />
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.checkOut')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.guests')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.amount')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.source')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('bookings.col.status')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                    {t('bookings.col.created')} <SortIcon k="created_at" />
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(b => {
                  const st = STATUS_MAP[b.status] ?? { label: b.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 group">
                      <td className="px-3 py-2.5">
                        <Link href={`/booking/bookings/${b.id}`}
                          className="font-medium text-indigo-600 group-hover:underline">
                          {b.guest_name || t('bookings.noName')}
                        </Link>
                        {b.guest_phone && <div className="text-xs text-gray-400">{b.guest_phone}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{b.properties?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{b.check_in}</td>
                      <td className="px-3 py-2.5 text-gray-700">{b.check_out}</td>
                      <td className="px-3 py-2.5 text-gray-600">{b.num_guests}</td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {b.total_price ? `${b.currency} ${Number(b.total_price).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{PLATFORM_NAMES[b.platform] ?? b.platform}</td>
                      <td className="px-3 py-2.5">
                        <select value={b.status} onChange={e => updateStatus(b.id, e.target.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${st.color}`}>
                          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">
                        <div>{new Date(b.created_at).toLocaleDateString(locale)}</div>
                        {b.notes && (
                          <div className="text-[10px] text-amber-600 mt-0.5 max-w-[100px] truncate" title={b.notes}>⚠ {b.notes}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          {b.guest_email && (
                            <button onClick={() => sendConfirmation(b.id)} disabled={sendingNotif === b.id}
                              title={t('bookings.sendConfirmTitle')} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 disabled:opacity-50">
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => removeBooking(b.id)}
                            title={t('bookings.deleteTitle')} className="p-1.5 rounded hover:bg-rose-50 text-gray-300 hover:text-rose-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Modal */}
      {adding && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-gray-900">{t('bookings.addModalTitle')}</h3>
            {[
              { label: t('bookings.form.guestName'), key: 'guest_name', placeholder: t('bookings.form.guestNamePlaceholder') },
              { label: t('bookings.form.phone'),     key: 'guest_phone', placeholder: '0912-345-678' },
              { label: 'Email',                      key: 'guest_email', placeholder: 'guest@example.com' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{f.label}</label>
                <input value={(form as unknown as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.checkIn')}</label>
                <input type="date" value={form.check_in} onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.checkOut')}</label>
                <input type="date" value={form.check_out} onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.guests')}</label>
                <input type="number" min={1} value={form.num_guests} onChange={e => setForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.amount')}</label>
                <input type="number" value={form.total_price} onChange={e => setForm(p => ({ ...p, total_price: e.target.value }))}
                  placeholder="5000"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.room')}</label>
                <select value={form.property_id} onChange={e => setForm(p => ({ ...p, property_id: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">{t('bookings.form.unspecified')}</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.platform')}</label>
                <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            {/* 加購服務 */}
            {profileExtras && (profileExtras.breakfast?.type === 'optional' || profileExtras.addon_services.some(s => s.enabled)) && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">{t('bookings.form.addons')}</label>
                <div className="rounded-lg border divide-y">
                  {profileExtras.breakfast?.type === 'optional' && (
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={form.extras.breakfast}
                        onChange={e => setForm(p => ({ ...p, extras: { ...p.extras, breakfast: e.target.checked } }))}
                        className="rounded" />
                      <span className="text-sm text-gray-700">{t('bookings.form.breakfast')}</span>
                      {profileExtras.breakfast.price_per_person > 0 && (
                        <span className="text-xs text-gray-400 ml-auto">NT$ {profileExtras.breakfast.price_per_person}{t('bookings.form.perPerson')}</span>
                      )}
                    </label>
                  )}
                  {profileExtras.addon_services.filter(s => s.enabled).map(svc => (
                    <label key={svc.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox"
                        checked={form.extras.services.includes(svc.id)}
                        onChange={e => setForm(p => ({
                          ...p, extras: {
                            ...p.extras,
                            services: e.target.checked
                              ? [...p.extras.services, svc.id]
                              : p.extras.services.filter(s => s !== svc.id),
                          },
                        }))}
                        className="rounded" />
                      <span className="text-sm text-gray-700">{svc.name}</span>
                      {svc.note && <span className="text-xs text-gray-400 truncate">{svc.note}</span>}
                      {svc.price > 0 && (
                        <span className="text-xs text-gray-400 ml-auto shrink-0">
                          NT$ {svc.price}/{svc.unit === 'per_trip' ? t('units.perTrip') : svc.unit === 'per_stay' ? t('units.perStay') : svc.unit === 'per_person' ? t('units.perPerson') : t('units.perNight')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 優惠碼 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('bookings.form.promoCode')}</label>
              <div className="flex gap-2">
                <input value={promoInput} onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoResult(null) }}
                  onKeyDown={e => e.key === 'Enter' && checkPromo()}
                  placeholder={t('bookings.form.promoPlaceholder')}
                  className="flex-1 text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button type="button" onClick={checkPromo} disabled={!promoInput || promoChecking}
                  className="px-3 py-2 rounded-lg border text-sm text-indigo-600 border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap">
                  {promoChecking ? '…' : t('bookings.form.apply')}
                </button>
              </div>
              {promoResult && (
                <div className={`text-xs px-2 py-1 rounded ${promoResult.valid ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                  {promoResult.valid
                    ? `✓ ${t('bookings.form.promoDiscount', { name: promoResult.name || promoInput, discount: promoResult.discount?.toLocaleString() ?? '' })}`
                    : `✗ ${promoResult.error}`}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('bookings.form.notes')}</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)} className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={save} disabled={!form.guest_name || !form.check_in || !form.check_out || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? t('bookings.form.saving') : t('bookings.add')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
