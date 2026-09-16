'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, Loader2, Undo2, ShieldCheck, ShieldOff } from 'lucide-react'

interface Correction {
  id: string
  situation: string
  wrong_reply: string
  correct_guidance: string
  status: 'active' | 'reverted'
  created_by: string
  created_at: string
  reverted_by: string | null
  reverted_at: string | null
}

const formatDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

export function CsCorrectionsPanel() {
  const t = useTranslations('CsCorrectionsPanel')
  const locale = useLocale()
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [authors, setAuthors] = useState<Record<string, string>>({})
  const [canCorrectAi, setCanCorrectAi] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [situation, setSituation] = useState('')
  const [wrongReply, setWrongReply] = useState('')
  const [correctGuidance, setCorrectGuidance] = useState('')
  const [saving, setSaving] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/cs-ai-corrections')
      const data = await res.json()
      setCorrections(data.corrections ?? [])
      setAuthors(data.authors ?? {})
      setCanCorrectAi(!!data.canCorrectAi)
      setIsOwner(!!data.isOwner)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setSituation(''); setWrongReply(''); setCorrectGuidance(''); setError(''); setCreating(false)
  }

  const submit = async () => {
    if (!situation.trim()) { setError(t('errSituation')); return }
    if (!wrongReply.trim()) { setError(t('errWrongReply')); return }
    if (!correctGuidance.trim()) { setError(t('errCorrectGuidance')); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/marketing/cs-ai-corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, wrongReply, correctGuidance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('submitFailed'))
      resetForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const revert = async (id: string) => {
    if (!confirm(t('confirmRevert'))) return
    setRevertingId(id)
    try {
      await fetch(`/api/marketing/cs-ai-corrections/${id}`, { method: 'PATCH' })
      await load()
    } finally {
      setRevertingId(null)
    }
  }

  const active = corrections.filter(c => c.status === 'active')
  const reverted = corrections.filter(c => c.status === 'reverted')

  return (
    <div className="space-y-5">
      <div className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">{t('title')}</h2>
        <p className="text-xs text-gray-500 mb-4">
          {t('intro')}
        </p>

        {!canCorrectAi ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            {t('noPermission')}
          </div>
        ) : creating ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('situationLabel')}</label>
              <textarea value={situation} onChange={e => setSituation(e.target.value)} rows={2}
                placeholder={t('situationPlaceholder')}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wrongReplyLabel')}</label>
              <textarea value={wrongReply} onChange={e => setWrongReply(e.target.value)} rows={3}
                placeholder={t('wrongReplyPlaceholder')}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('correctGuidanceLabel')}</label>
              <textarea value={correctGuidance} onChange={e => setCorrectGuidance(e.target.value)} rows={2}
                placeholder={t('correctGuidancePlaceholder')}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{t('submitButton')}
              </button>
              <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">{t('cancel')}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="h-4 w-4" />{t('addButton')}
          </button>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('activeTitle', { count: active.length })}</h2>
        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">{t('loading')}</div>
        ) : active.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">{t('noActive')}</div>
        ) : (
          <div className="divide-y">
            {active.map(c => (
              <div key={c.id} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-900 flex-1">{c.situation}</p>
                  {isOwner && (
                    <button onClick={() => revert(c.id)} disabled={revertingId === c.id}
                      className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                      {revertingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}{t('revert')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">{t('wrongReplyPrefix')}{c.wrong_reply}</p>
                <p className="text-xs text-emerald-600">{t('correctGuidancePrefix')}{c.correct_guidance}</p>
                <p className="text-[11px] text-gray-300">
                  {authors[c.created_by] ?? t('unknown')} · {formatDateTime(c.created_at, locale)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {reverted.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">{t('revertedTitle', { count: reverted.length })}</h2>
          <div className="divide-y opacity-60">
            {reverted.map(c => (
              <div key={c.id} className="py-3 space-y-1">
                <p className="text-sm text-gray-500 line-through">{c.situation}</p>
                <p className="text-[11px] text-gray-300">
                  {t('revertedByPrefix', { name: authors[c.reverted_by ?? ''] ?? t('unknown'), time: c.reverted_at ? formatDateTime(c.reverted_at, locale) : '' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
