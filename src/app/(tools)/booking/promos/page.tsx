'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { Plus, Edit2, Trash2, Percent, ToggleLeft, ToggleRight } from 'lucide-react'

interface Promo {
  id: string; code: string; name: string
  type: 'percent' | 'fixed'; value: number
  min_nights: number; min_amount: number | null
  valid_from: string | null; valid_to: string | null
  max_uses: number | null; used_count: number; enabled: boolean
  created_at: string
}

const EMPTY_FORM = {
  code: '', name: '', type: 'percent' as 'percent' | 'fixed',
  value: '', min_nights: 1, min_amount: '',
  valid_from: '', valid_to: '', max_uses: '', enabled: true,
}

export default function PromosPage() {
  const t = useTranslations('Booking')
  const [promos, setPromos]   = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Promo | null>(null)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    fetch('/api/booking/promos').then(r => r.json())
      .then(d => setPromos(d.promos ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openAdd() { setAdding(true); setForm(EMPTY_FORM) }

  function openEdit(p: Promo) {
    setEditing(p)
    setForm({
      code: p.code, name: p.name, type: p.type, value: String(p.value),
      min_nights: p.min_nights, min_amount: p.min_amount ? String(p.min_amount) : '',
      valid_from: p.valid_from ?? '', valid_to: p.valid_to ?? '',
      max_uses: p.max_uses ? String(p.max_uses) : '', enabled: p.enabled,
    })
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        ...form, value: parseFloat(form.value) || 0,
        min_amount: form.min_amount ? parseFloat(form.min_amount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        valid_from: form.valid_from || null, valid_to: form.valid_to || null,
      }
      if (editing) {
        const res = await fetch('/api/booking/promos', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        })
        const d = await res.json()
        if (d.promo) setPromos(prev => prev.map(p => p.id === editing.id ? d.promo : p))
        else alert(d.error)
      } else {
        const res = await fetch('/api/booking/promos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await res.json()
        if (d.promo) setPromos(prev => [d.promo, ...prev])
        else alert(d.error)
      }
      setEditing(null); setAdding(false)
    } finally { setSaving(false) }
  }

  async function toggleEnabled(p: Promo) {
    const res = await fetch('/api/booking/promos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, enabled: !p.enabled }),
    })
    const d = await res.json()
    if (d.promo) setPromos(prev => prev.map(x => x.id === p.id ? d.promo : x))
  }

  async function del(id: string) {
    if (!confirm(t('promos.deleteConfirm'))) return
    await fetch('/api/booking/promos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPromos(prev => prev.filter(p => p.id !== id))
  }

  const isOpen = adding || editing !== null
  const today = new Date().toISOString().slice(0, 10)

  function promoStatus(p: Promo) {
    if (!p.enabled) return { label: t('promos.status.disabled'), color: 'bg-gray-100 text-gray-500' }
    if (p.valid_from && p.valid_from > today) return { label: t('promos.status.notStarted'), color: 'bg-amber-100 text-amber-700' }
    if (p.valid_to && p.valid_to < today) return { label: t('promos.status.expired'), color: 'bg-red-100 text-red-600' }
    if (p.max_uses && p.used_count >= p.max_uses) return { label: t('promos.status.usedUp'), color: 'bg-orange-100 text-orange-700' }
    return { label: t('promos.status.active'), color: 'bg-green-100 text-green-700' }
  }

  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('promos.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('promos.subtitle')}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> {t('promos.add')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t('common.loading')}</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <Percent className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">{t('promos.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t('promos.col.code')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">{t('promos.col.discount')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">{t('promos.col.validity')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">{t('promos.col.uses')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t('promos.col.status')}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {promos.map(p => {
                const st = promoStatus(p)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-gray-900 text-sm">{p.code}</div>
                      {p.name && <div className="text-xs text-gray-400 mt-0.5">{p.name}</div>}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {p.type === 'percent' ? t('promos.percentOff', { value: p.value }) : t('promos.fixedOff', { value: p.value })}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-semibold text-indigo-700">
                        {p.type === 'percent' ? `${p.value}%` : `NT$ ${p.value}`}
                      </span>
                      {p.min_nights > 1 && <div className="text-[11px] text-gray-400">{t('promos.minNightsShort', { count: p.min_nights })}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {p.valid_from || p.valid_to
                        ? `${p.valid_from ?? '—'} ~ ${p.valid_to ?? '—'}`
                        : <span className="text-gray-400">{t('promos.unlimited')}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      <span className="text-gray-700">{p.used_count}</span>
                      {p.max_uses && <span className="text-gray-400"> / {p.max_uses}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => toggleEnabled(p)} title={p.enabled ? t('notif.disabled') : t('notif.enabled')}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                          {p.enabled ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => del(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
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
      )}

      {isOpen && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) { setAdding(false); setEditing(null) } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-gray-900">{editing ? t('promos.editTitle') : t('promos.addTitle')}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.code')} <span className="text-red-500">*</span></label>
                <input value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20"
                  className="w-full text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.name')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('promos.form.namePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('promos.form.type')}</label>
              <div className="flex gap-2">
                {(['percent','fixed'] as const).map(pt => (
                  <button key={pt} type="button" onClick={() => setForm(f => ({ ...f, type: pt }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                      ${form.type === pt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                    {pt === 'percent' ? t('promos.form.percent') : t('promos.form.fixed')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  {form.type === 'percent' ? t('promos.form.valuePercent') : t('promos.form.valueFixed')} <span className="text-red-500">*</span>
                </label>
                <input type="number" min={0} value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={form.type === 'percent' ? '10' : '500'}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.minNights')}</label>
                <input type="number" min={1} value={form.min_nights}
                  onChange={e => setForm(f => ({ ...f, min_nights: parseInt(e.target.value) || 1 }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.validFrom')}</label>
                <input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.validTo')}</label>
                <input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.maxUses')}</label>
                <input type="number" min={1} value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder={t('promos.form.blankUnlimited')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('promos.form.minAmount')}</label>
                <input type="number" min={0} value={form.min_amount}
                  onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))}
                  placeholder={t('promos.form.blankUnlimited')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="rounded" />
              <span className="text-sm text-gray-700">{t('promos.form.enableNow')}</span>
            </label>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); setEditing(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={save} disabled={!form.code || !form.value || saving}
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
