'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createPortal } from 'react-dom'
import { RefreshCw, Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ICalSetting {
  id: string; property_id: string | null; platform: string; platform_name: string; ical_url: string
  sync_enabled: boolean; last_synced_at: string | null; last_sync_count: number | null
  last_sync_error: string | null; properties?: { name: string }
}
interface Property { id: string; name: string }

export default function ICalPage() {
  const t = useTranslations('Booking')
  const locale = useLocale()
  const PLATFORMS = [
    { id: 'booking_com', name: 'Booking.com' },
    { id: 'agoda',       name: 'Agoda' },
    { id: 'airbnb',      name: 'Airbnb' },
    { id: 'trip_com',    name: 'Trip.com' },
    { id: 'asiayo',      name: 'AsiaYo' },
    { id: 'easytravel',  name: 'EasyTravel' },
    { id: 'other',       name: t('ical.platformOther') },
  ]
  const [settings, setSettings]   = useState<ICalSetting[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string | null>(null)
  const [adding, setAdding]       = useState(false)
  const [form, setForm] = useState({ property_id: '', platform: 'booking_com', platform_name: '', ical_url: '', sync_interval: 60 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/booking/ical').then(r => r.json()),
      fetch('/api/booking/properties').then(r => r.json()),
    ]).then(([ic, pr]) => {
      setSettings(ic.settings ?? [])
      setProperties(pr.properties ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function sync(id?: string) {
    setSyncing(id ?? 'all')
    try {
      const res = await fetch('/api/booking/ical/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { setting_id: id } : {}),
      })
      const d = await res.json()
      const total = (d.results ?? []).reduce((s: number, r: { added: number; updated: number }) => s + r.added + r.updated, 0)
      alert(t('ical.syncDone', { count: total }))
      const ic = await fetch('/api/booking/ical').then(r => r.json())
      setSettings(ic.settings ?? [])
    } finally { setSyncing(null) }
  }

  async function save() {
    setSaving(true)
    try {
      const pName = PLATFORMS.find(p => p.id === form.platform)?.name ?? form.platform_name
      const res = await fetch('/api/booking/ical', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, platform_name: pName }),
      })
      const d = await res.json()
      if (d.setting) {
        setSettings(prev => [...prev, d.setting])
        setAdding(false)
        setForm({ property_id: '', platform: 'booking_com', platform_name: '', ical_url: '', sync_interval: 60 })
      } else alert(d.error)
    } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm(t('ical.deleteConfirm'))) return
    await fetch('/api/booking/ical', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSettings(prev => prev.filter(s => s.id !== id))
  }

  async function toggleEnable(s: ICalSetting) {
    await fetch('/api/booking/ical', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, sync_enabled: !s.sync_enabled }),
    })
    setSettings(prev => prev.map(x => x.id === s.id ? { ...x, sync_enabled: !x.sync_enabled } : x))
  }

  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('nav.ical')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('ical.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sync()}
            disabled={syncing !== null || settings.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">{t('ical.syncAll')}</span>
            <span className="sm:hidden">{t('ical.sync')}</span>
          </button>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border text-sm font-medium hover:bg-gray-50">
            <Plus className="h-4 w-4" /> {t('bookings.add')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">{t('common.loading')}</div>
      ) : settings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <RefreshCw className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">{t('ical.empty')}</p>
          <button onClick={() => setAdding(true)} className="text-indigo-600 text-sm hover:underline">{t('ical.addFirst')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map(s => (
            <div key={s.id} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
                    {s.properties?.name ?? properties.find(p => p.id === s.property_id)?.name ?? t('bookings.form.unspecified')}
                  </span>
                  <span className="font-semibold text-sm text-gray-900">{s.platform_name || s.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnable(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.sync_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.sync_enabled ? t('notif.enabled') : t('notif.disabled')}
                  </button>
                  <button onClick={() => sync(s.id)} disabled={syncing !== null}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 disabled:opacity-40">
                    {syncing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  <button onClick={() => del(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 font-mono truncate">{s.ical_url}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
                {s.last_synced_at && <span>{t('ical.lastPrefix', { date: new Date(s.last_synced_at).toLocaleString(locale, { timeZone: 'Asia/Taipei' }) })}</span>}
                {s.last_sync_count != null && <span>{t('bookings.count', { count: s.last_sync_count })}</span>}
                {s.last_sync_error
                  ? <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{s.last_sync_error.slice(0, 50)}</span>
                  : s.last_synced_at && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />{t('ical.normal')}</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {adding && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-gray-900">{t('ical.addTitle')}</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('ical.platform')}</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('ical.propertyOptional')}</label>
              <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">{t('bookings.form.unspecified')}</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">iCal URL <span className="text-red-500">*</span></label>
              <input value={form.ical_url} onChange={e => setForm(f => ({ ...f, ical_url: e.target.value }))}
                placeholder="https://www.booking.com/ical/..."
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
              <p className="text-[10px] text-gray-400">{t('ical.urlHint')}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('ical.interval')}</label>
              <input type="number" min={15} max={1440} value={form.sync_interval}
                onChange={e => setForm(f => ({ ...f, sync_interval: parseInt(e.target.value) }))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={save} disabled={!form.ical_url.trim() || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? t('bookings.form.saving') : t('detail.save')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
