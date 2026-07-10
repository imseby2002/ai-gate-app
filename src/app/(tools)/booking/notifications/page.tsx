'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { Bell, Edit2, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface EmailTemplate {
  id?: string; type: string; subject: string; body_html: string; enabled: boolean
}

const TEMPLATE_TYPES = [
  { type: 'confirmation', icon: '✅' },
  { type: 'reminder',     icon: '🔔' },
  { type: 'checkout',     icon: '🏠' },
  { type: 'cancellation', icon: '❌' },
]

const DEFAULT_SUBJECT: Record<string, string> = {
  confirmation: '【訂房確認】感謝您預訂 {{bnb_name}}',
  reminder:     '【入住提醒】明天入住 {{bnb_name}}，相關資訊請查看',
  checkout:     '【退房提醒】今日退房時間 {{check_out_time}}，感謝入住',
  cancellation: '【訂單取消】您的訂房已取消',
}

const PLACEHOLDERS = [
  '{{guest_name}}','{{bnb_name}}','{{property_name}}',
  '{{check_in}}','{{check_out}}','{{num_nights}}','{{num_guests}}',
  '{{total_price}}','{{check_in_time}}','{{check_out_time}}',
  '{{bnb_phone}}','{{bnb_email}}','{{notes}}','{{notes_block}}',
]

export default function NotificationsPage() {
  const t = useTranslations('Booking')
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({})
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<string | null>(null)
  const [form, setForm]           = useState({ subject: '', body_html: '', enabled: true })
  const [saving, setSaving]       = useState(false)
  const [testSending, setTestSending] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    fetch('/api/booking/notifications/templates').then(r => r.json()).then(d => {
      const map: Record<string, EmailTemplate> = {}
      for (const t of d.templates ?? []) map[t.type] = t
      setTemplates(map)
    }).finally(() => setLoading(false))
  }, [])

  function openEdit(type: string) {
    const tpl = templates[type]
    setForm({
      subject:  tpl?.subject  ?? DEFAULT_SUBJECT[type] ?? '',
      body_html: tpl?.body_html ?? '',
      enabled:  tpl?.enabled  ?? true,
    })
    setEditing(type)
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/booking/notifications/templates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: editing, ...form }),
      })
      const d = await res.json()
      if (d.template) setTemplates(prev => ({ ...prev, [editing]: d.template }))
      setEditing(null)
    } finally { setSaving(false) }
  }

  async function toggleEnabled(type: string) {
    const tpl = templates[type]
    const next = !(tpl?.enabled ?? true)
    const res = await fetch('/api/booking/notifications/templates', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, subject: tpl?.subject ?? DEFAULT_SUBJECT[type] ?? '', body_html: tpl?.body_html ?? '', enabled: next }),
    })
    const d = await res.json()
    if (d.template) setTemplates(prev => ({ ...prev, [type]: d.template }))
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">{t('common.loading')}</div>

  return (
    <div className="p-4 md:p-6 pb-16 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('notif.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('notif.subtitle')}</p>
      </div>

      <div className="space-y-3">
        {TEMPLATE_TYPES.map(({ type, icon }) => {
          const tpl = templates[type]
          const isEnabled = tpl?.enabled ?? true
          return (
            <div key={type} className="bg-white rounded-xl border p-4 flex items-start gap-4">
              <div className="text-2xl shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{t(`notif.types.${type}.label`)}</span>
                  {tpl && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isEnabled ? t('notif.enabled') : t('notif.disabled')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{t(`notif.types.${type}.desc`)}</div>
                {tpl?.subject && <div className="text-xs text-gray-500 mt-1 truncate">{t('notif.subjectPrefix', { subject: tpl.subject })}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {tpl && (
                  <button onClick={() => toggleEnabled(type)} title={isEnabled ? t('notif.disabled') : t('notif.enabled')}
                    className="p-1.5 rounded hover:bg-gray-100">
                    {isEnabled
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft  className="h-4 w-4 text-gray-400" />}
                  </button>
                )}
                <button onClick={() => openEdit(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border hover:bg-indigo-50 text-indigo-600 border-indigo-200">
                  <Edit2 className="h-3 w-3" /> {tpl ? t('notif.edit') : t('notif.setup')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Placeholder reference */}
      <section className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-indigo-500" /> {t('notif.placeholdersTitle')}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(p => (
            <code key={p} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{p}</code>
          ))}
        </div>
      </section>

      {/* Edit Modal */}
      {editing && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col">
            <div className="px-5 pt-5 pb-3 shrink-0 border-b">
              <h3 className="font-bold text-gray-900">
                {t(`notif.types.${editing}.label`)}
              </h3>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('notif.emailSubject')}</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder={DEFAULT_SUBJECT[editing] ?? ''}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('notif.emailBody')}</label>
                <textarea value={form.body_html}
                  onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
                  rows={14} placeholder={t('notif.bodyPlaceholder')}
                  className="w-full text-xs font-mono border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, body_html: f.body_html + p }))}
                    className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono hover:bg-indigo-100">
                    {p}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.enabled}
                  onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">{t('notif.enableThis')}</span>
              </label>
            </div>

            <div className="shrink-0 flex gap-2 px-5 py-4 border-t">
              <button onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
