'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, Trash2, Copy, Check, Loader2, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'

interface CsForm {
  id: string
  name: string
  slug: string
  fields: CsFormField[]
  trigger_keywords: string
  notify_target: CsFormNotifyTarget
  enabled: boolean
  created_at: string
  available_weekdays: number[]
  confirm_before_fields: boolean
}

// route.ts 那份是伺服器端模組（依賴 next/headers），client component 只能拿型別，
// 不能連值一起 import，不然整個伺服器端模組會被打包進前端 bundle 導致建置失敗。
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAY_KEYS = ['wd0', 'wd1', 'wd2', 'wd3', 'wd4', 'wd5', 'wd6']
const getWeekdayLabels = (t: (key: string) => string) => WEEKDAY_KEYS.map(k => t(k))

interface CsFormSubmission {
  id: string
  answers: Record<string, string>
  room_ref: string | null
  source: string
  platform: string | null
  created_at: string
  updated_at: string | null
  notified_at: string | null
  notify_error: string | null
}

const getFieldTypes = (t: (key: string) => string): { value: CsFormField['type']; label: string }[] => [
  { value: 'text', label: t('fieldTypeText') },
  { value: 'textarea', label: t('fieldTypeTextarea') },
  { value: 'select', label: t('fieldTypeSelect') },
  { value: 'radio', label: t('fieldTypeRadio') },
  { value: 'number', label: t('fieldTypeNumber') },
]

function emptyField(): CsFormField {
  return { id: Math.random().toString(36).slice(2, 9), label: '', type: 'text', required: false }
}

function emptyNotifyTarget(): CsFormNotifyTarget {
  return { platform: '', to: '', batchMode: 'daily', batchTime: '08:00' }
}

const formatDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

export function CsFormsPanel({ industry, appUrl }: { industry: string; appUrl: string }) {
  const t = useTranslations('CsFormsPanel')
  const locale = useLocale()
  const WEEKDAY_LABELS = getWeekdayLabels(t)
  const FIELD_TYPES = getFieldTypes(t)
  const [forms, setForms] = useState<CsForm[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [expandedSubs, setExpandedSubs] = useState<string | null>(null)
  const [subs, setSubs] = useState<CsFormSubmission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [fields, setFields] = useState<CsFormField[]>([emptyField()])
  const [triggerKeywords, setTriggerKeywords] = useState('')
  const [notifyTarget, setNotifyTarget] = useState<CsFormNotifyTarget>(emptyNotifyTarget())
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>(ALL_WEEKDAYS)
  const [confirmBeforeFields, setConfirmBeforeFields] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadForms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/cs-forms?industry=${industry}`)
      const data = await res.json()
      setForms(data.forms ?? [])
    } finally {
      setLoading(false)
    }
  }, [industry])

  useEffect(() => { loadForms() }, [loadForms])

  const resetEditor = () => {
    setName(''); setFields([emptyField()]); setTriggerKeywords(''); setNotifyTarget(emptyNotifyTarget())
    setAvailableWeekdays(ALL_WEEKDAYS); setConfirmBeforeFields(true)
    setError(''); setEditingId(null); setCreating(false)
  }

  const startCreate = () => { resetEditor(); setCreating(true) }

  const startEdit = (f: CsForm) => {
    setName(f.name); setFields(f.fields.length ? f.fields : [emptyField()])
    setTriggerKeywords(f.trigger_keywords)
    setNotifyTarget(f.notify_target?.platform !== undefined ? f.notify_target : emptyNotifyTarget())
    setAvailableWeekdays(f.available_weekdays?.length ? f.available_weekdays : ALL_WEEKDAYS)
    setConfirmBeforeFields(f.confirm_before_fields !== false)
    setError(''); setEditingId(f.id); setCreating(false)
  }

  const toggleWeekday = (d: number) => {
    setAvailableWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  const save = async () => {
    if (!name.trim()) { setError(t('errFormName')); return }
    const cleanFields = fields.filter(f => f.label.trim())
    if (!cleanFields.length) { setError(t('errAtLeastOneField')); return }
    if (!availableWeekdays.length) { setError(t('errAtLeastOneWeekday')); return }
    setSaving(true); setError('')
    try {
      const body = { name: name.trim(), fields: cleanFields, triggerKeywords, notifyTarget, industry, availableWeekdays, confirmBeforeFields }
      const res = editingId
        ? await fetch(`/api/marketing/cs-forms/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/marketing/cs-forms', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('saveFailed')); return }
      resetEditor()
      loadForms()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(t('confirmDeleteForm'))) return
    await fetch(`/api/marketing/cs-forms/${id}`, { method: 'DELETE' })
    loadForms()
  }

  const toggleEnabled = async (f: CsForm) => {
    await fetch(`/api/marketing/cs-forms/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !f.enabled }),
    })
    loadForms()
  }

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${appUrl}/f/${slug}`)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 1500)
  }

  const toggleSubs = async (id: string) => {
    if (expandedSubs === id) { setExpandedSubs(null); return }
    setExpandedSubs(id)
    setSubsLoading(true)
    try {
      const res = await fetch(`/api/marketing/cs-forms/${id}/submissions`)
      const data = await res.json()
      setSubs(data.submissions ?? [])
    } finally {
      setSubsLoading(false)
    }
  }

  const handleManualNotify = async (formId: string, subId: string) => {
    if (!confirm(t('confirmManualNotify'))) return
    setNotifyingId(subId)
    try {
      const res = await fetch(`/api/marketing/cs-forms/${formId}/submissions/${subId}/notify`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || t('notifyFailedAlert'))
        return
      }
      setSubs(prev => prev.map(s => s.id === subId ? { ...s, notified_at: data.notified_at, notify_error: null } : s))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('notifyConnFailedAlert'))
    } finally {
      setNotifyingId(null)
    }
  }

  const updateField = (idx: number, patch: Partial<CsFormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const editorOpen = creating || editingId

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">{t('selfBuiltForms')}</div>
          <div className="text-xs text-gray-400 mt-0.5">{t('selfBuiltFormsDesc')}</div>
        </div>
        {!editorOpen && (
          <button onClick={startCreate}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
            style={{ background: 'var(--primary)' }}>
            <Plus className="h-3.5 w-3.5" />{t('addForm')}
          </button>
        )}
      </div>

      {editorOpen && (
        <div className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('formNameLabel')}</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={t('formNamePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('triggerKeywordsLabel')}</label>
            <input value={triggerKeywords} onChange={e => setTriggerKeywords(e.target.value)}
              placeholder={t('triggerKeywordsPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500">{t('formFieldsLabel')}</label>
            {fields.map((f, idx) => (
              <div key={f.id} className="border rounded-lg p-2.5 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })}
                    placeholder={t('fieldNamePlaceholder')}
                    className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
                  <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as CsFormField['type'] })}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                    {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                    {t('required')}
                  </label>
                  <button onClick={() => setFields(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(f.type === 'select' || f.type === 'radio') && (
                  <input value={(f.options ?? []).join(',')}
                    onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder={t('optionsPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500" />
                )}
              </div>
            ))}
            <button onClick={() => setFields(prev => [...prev, emptyField()])}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <Plus className="h-3 w-3" />{t('addField')}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('availableWeekdaysLabel')}</label>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, d) => (
                <button key={d} type="button" onClick={() => toggleWeekday(d)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium border ${availableWeekdays.includes(d) ? 'text-white border-transparent' : 'bg-white text-gray-400 border-gray-300'}`}
                  style={availableWeekdays.includes(d) ? { background: 'var(--primary)' } : undefined}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={confirmBeforeFields}
              onChange={e => setConfirmBeforeFields(e.target.checked)} />
            <span>{t('confirmBeforeFieldsLabel')}</span>
          </label>

          <div className="border rounded-lg p-2.5 bg-white space-y-2">
            <label className="block text-xs font-medium text-gray-500">{t('notifyAfterSubmitLabel')}</label>
            <div className="flex gap-2">
              <select value={notifyTarget.platform}
                onChange={e => setNotifyTarget(prev => ({ ...prev, platform: e.target.value as CsFormNotifyTarget['platform'] }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">{t('notifyNone')}</option>
                <option value="line">{t('notifyLine')}</option>
                <option value="telegram">{t('notifyTelegram')}</option>
                <option value="email">{t('notifyEmail')}</option>
                <option value="webhook">{t('notifyWebhook')}</option>
              </select>
              {notifyTarget.platform && (
                <input value={notifyTarget.to} onChange={e => setNotifyTarget(prev => ({ ...prev, to: e.target.value }))}
                  placeholder={notifyTarget.platform === 'line' ? t('notifyToLinePlaceholder') : notifyTarget.platform === 'telegram' ? t('notifyToTelegramPlaceholder') : notifyTarget.platform === 'email' ? t('notifyToEmailPlaceholder') : t('notifyToWebhookPlaceholder')}
                  className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
              )}
            </div>
            {notifyTarget.platform === 'line' && (
              <div>
                <input value={notifyTarget.lineToken ?? ''} onChange={e => setNotifyTarget(prev => ({ ...prev, lineToken: e.target.value }))}
                  placeholder={t('lineTokenPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500" />
                <div className="text-[10px] text-gray-400 mt-0.5">{t('lineTokenHint')}</div>
              </div>
            )}
            {notifyTarget.platform === 'telegram' && (
              <div>
                <input value={notifyTarget.telegramBotToken ?? ''} onChange={e => setNotifyTarget(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                  placeholder={t('telegramTokenPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500" />
                <div className="text-[10px] text-gray-400 mt-0.5">{t('telegramTokenHint')}</div>
              </div>
            )}
            {notifyTarget.platform && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={notifyTarget.batchMode === 'immediate'}
                      onChange={() => setNotifyTarget(prev => ({ ...prev, batchMode: 'immediate' }))} />
                    {t('batchImmediate')}
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={notifyTarget.batchMode === 'manual'}
                      onChange={() => setNotifyTarget(prev => ({ ...prev, batchMode: 'manual' }))} />
                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{t('batchManual')}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={notifyTarget.batchMode === 'daily'}
                      onChange={() => setNotifyTarget(prev => ({ ...prev, batchMode: 'daily' }))} />
                    {t('batchDaily')}
                  </label>
                  {notifyTarget.batchMode === 'daily' && (
                    <input type="time" value={notifyTarget.batchTime}
                      onChange={e => setNotifyTarget(prev => ({ ...prev, batchTime: e.target.value }))}
                      className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
                  )}
                </div>
                {notifyTarget.batchMode === 'manual' && (
                  <p className="text-[11px] text-gray-500 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                    {t.rich('batchManualHint', { b: (chunks) => <strong>{chunks}</strong> })}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {saving ? t('savingEllipsis') : t('save')}
            </button>
            <button onClick={resetEditor} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />{t('loadingEllipsis')}</div>}

      {!loading && forms.length === 0 && !editorOpen && (
        <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
          <div className="mb-2">{t('noFormsYet')}</div>
          <div className="text-xs">{t('noFormsHint')}</div>
        </div>
      )}

      {forms.length > 0 && (
        <div className="space-y-2">
          {forms.map(f => (
            <div key={f.id} className="border rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{f.name}</span>
                  {!f.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 border">{t('disabledBadge')}</span>}
                  {f.available_weekdays?.length > 0 && f.available_weekdays.length < 7 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                      {t('weeklyOpenBadge', { days: f.available_weekdays.map(d => WEEKDAY_LABELS[d]).join('、') })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => copyLink(f.slug)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                    {copiedSlug === f.slug ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {t('copyLink')}
                  </button>
                  <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer"
                    className="text-gray-400 hover:text-gray-600 p-1"><ExternalLink className="h-3.5 w-3.5" /></a>
                  <button onClick={() => toggleEnabled(f)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                    {f.enabled ? t('disable') : t('enable')}
                  </button>
                  <button onClick={() => startEdit(f)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">{t('edit')}</button>
                  <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <button onClick={() => toggleSubs(f.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                {expandedSubs === f.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t('viewSubmissions')}
              </button>

              {expandedSubs === f.id && (
                <div className="border-t pt-2 space-y-1.5">
                  {subsLoading && <div className="text-xs text-gray-400">{t('loadingEllipsis')}</div>}
                  {!subsLoading && subs.length === 0 && <div className="text-xs text-gray-400">{t('noSubmissionsYet')}</div>}
                  {!subsLoading && subs.map(s => (
                    <div key={s.id} className="text-xs bg-gray-50 rounded-lg p-2.5 space-y-2 border">
                      <div className="flex items-center gap-2 text-gray-400 flex-wrap">
                        <span>{formatDateTime(s.created_at, locale)}</span>
                        {s.updated_at && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
                            {t('updatedPrefix', { time: formatDateTime(s.updated_at, locale) })}
                          </span>
                        )}
                        {s.room_ref && <span className="px-1.5 py-0.5 rounded bg-gray-100 border">{t('roomRefPrefix', { value: s.room_ref })}</span>}
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 border">{s.source === 'public_form' ? t('sourcePublicForm') : t('sourceCsChat')}</span>
                        {s.notify_error && (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-600" title={s.notify_error}>
                            {t('notifyFailedPrefix', { msg: s.notify_error.slice(0, 40) })}
                          </span>
                        )}
                        {!s.notify_error && s.notified_at && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                            {t('notifiedPrefix', { time: formatDateTime(s.notified_at, locale) })}
                          </span>
                        )}
                        {!s.notify_error && !s.notified_at && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                            {t('pendingNotify')}
                          </span>
                        )}
                        {f.notify_target?.platform && (
                          <div className="ml-auto flex items-center gap-1.5">
                            {s.notified_at ? (
                              <button
                                type="button"
                                onClick={() => handleManualNotify(f.id, s.id)}
                                disabled={notifyingId === s.id}
                                className="px-2 py-0.5 rounded border border-gray-200 text-[11px] text-gray-500 hover:bg-white hover:text-gray-700 flex items-center gap-1 disabled:opacity-50 transition-colors"
                                title={t('resendNotifyTitle')}
                              >
                                {notifyingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                {t('resendNotify')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleManualNotify(f.id, s.id)}
                                disabled={notifyingId === s.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                              >
                                {notifyingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>💰</span>}
                                {t('confirmAndNotify')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-700 bg-white p-2.5 rounded-lg border space-y-1">
                        {f.fields.map(field => s.answers[field.id] ? (
                          <div key={field.id} className="whitespace-pre-line">
                            <span className="font-medium text-gray-500">{field.label}：</span>
                            <span>{s.answers[field.id]}</span>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
