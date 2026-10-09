'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Plus, Pencil, Trash2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CHANNEL_PLATFORMS, CHANNEL_PLATFORM_MAP, CHANNEL_MODULES, type ChannelModuleId } from '@/lib/channels/platforms'

interface Account {
  id: string
  platform: string
  name: string
  modules: string[]
  is_connected: boolean
  updated_at: string
  editable: boolean
  preview: Record<string, string>
}

interface Draft {
  id: string | null
  platform: string
  name: string
  modules: ChannelModuleId[]
  credentials: Record<string, string>
}

export function ChannelAccountsPage() {
  const t = useTranslations('ChannelAccounts')
  const locale = useLocale()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false)
  const [managed, setManaged] = useState<ChannelModuleId[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<'' | 'noCompany' | 'other'>('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/company/channels')
      if (res.status === 403) { setLoadError('noCompany'); return }
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      setAccounts(d.accounts)
      setIsCompanyAdmin(d.isCompanyAdmin)
      setManaged(d.managedModules)
      setLoadError('')
    } catch {
      setLoadError('other')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const canCreate = managed.length > 0
  const modLabel = (m: string) => t(`mod_${m}` as 'mod_cs')

  const startNew = () => {
    setError('')
    setDraft({ id: null, platform: CHANNEL_PLATFORMS[0].id, name: '', modules: isCompanyAdmin ? [] : [...managed], credentials: {} })
  }
  const startEdit = (a: Account) => {
    setError('')
    setDraft({ id: a.id, platform: a.platform, name: a.name, modules: a.modules as ChannelModuleId[], credentials: {} })
  }

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return
    if (!isCompanyAdmin && !draft.modules.some(m => managed.includes(m))) { setError(t('moduleRequired')); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(draft.id ? `/api/company/channels/${draft.id}` : '/api/company/channels', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: draft.platform, name: draft.name, modules: draft.modules, credentials: draft.credentials }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error === 'module_required' ? t('moduleRequired') : t('saveFailed', { error: d.error ?? res.status }))
        return
      }
      setDraft(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (a: Account) => {
    if (!confirm(t('confirmDelete', { name: a.name }))) return
    const res = await fetch(`/api/company/channels/${a.id}`, { method: 'DELETE' })
    if (!res.ok) { alert(t('saveFailed', { error: res.status })); return }
    await load()
  }

  if (loading && !accounts.length) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />{t('loading')}</div>
  }
  if (loadError === 'noCompany') return <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-muted-foreground">{t('noCompany')}</div>

  const platformDef = draft ? CHANNEL_PLATFORM_MAP[draft.platform] : null
  const editingAccount = draft?.id ? accounts.find(a => a.id === draft.id) : null

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">{t('subtitle')}</p>
          </div>
          {canCreate && !draft && (
            <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" />{t('add')}</Button>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{t('migrationNote')}</div>
        {!canCreate && <div className="text-sm text-muted-foreground">{t('noPermission')}</div>}
        {canCreate && !isCompanyAdmin && (
          <div className="text-sm text-muted-foreground">{t('managerHint', { modules: managed.map(modLabel).join('、') })}</div>
        )}
        {loadError === 'other' && <div className="text-sm text-red-600">{t('saveFailed', { error: 'load' })}</div>}

        {draft && platformDef && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('platform')}</span>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                  value={draft.platform}
                  disabled={!!draft.id}
                  onChange={e => setDraft({ ...draft, platform: e.target.value, credentials: {} })}
                >
                  {CHANNEL_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('name')}</span>
                <Input value={draft.name} maxLength={60} placeholder={t('namePh')} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </label>
            </div>

            <div className="space-y-1.5 text-sm">
              <span className="font-medium">{t('modules')}</span>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_MODULES.map(m => {
                  const allowed = isCompanyAdmin || managed.includes(m.id)
                  const on = draft.modules.includes(m.id)
                  return (
                    <label key={m.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${on ? 'border-primary bg-primary/5' : ''} ${allowed ? 'cursor-pointer' : 'opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!allowed}
                        onChange={() => setDraft({ ...draft, modules: on ? draft.modules.filter(x => x !== m.id) : [...draft.modules, m.id] })}
                      />
                      {modLabel(m.id)}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t('credentials')}</span>
                <a href={platformDef.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {t('doc')}<ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {draft.platform === 'zalo_oa' && <p className="text-xs text-muted-foreground">{t('zaloRefreshHint')}</p>}
              {platformDef.fields.map(f => (
                <label key={f.key} className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">{f.label}{f.optional && <span className="ml-1 text-xs">（{t('optional')}）</span>}</span>
                  <Input
                    type={f.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={draft.credentials[f.key] ?? ''}
                    placeholder={editingAccount?.preview[f.key] ? `${editingAccount.preview[f.key]}（${t('keepHint')}）` : ''}
                    onChange={e => setDraft({ ...draft, credentials: { ...draft.credentials, [f.key]: e.target.value } })}
                  />
                </label>
              ))}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>{t('cancel')}</Button>
              <Button onClick={save} disabled={saving || !draft.name.trim()}>
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t('saving')}</> : t('save')}
              </Button>
            </div>
          </div>
        )}

        {!accounts.length && !draft && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t('empty')}</div>}

        <div className="space-y-3">
          {accounts.map(a => {
            const p = CHANNEL_PLATFORM_MAP[a.platform]
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: p?.color ?? '#64748b' }}>
                  {(p?.name ?? a.platform).slice(0, 2)}
                </div>
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{p?.name ?? a.platform} · {t('updated', { time: new Date(a.updated_at).toLocaleString(locale, { hour12: false }) })}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.modules.length
                      ? a.modules.map(m => <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-muted">{modLabel(m)}</span>)
                      : <span className="text-xs text-muted-foreground">{t('noModules')}</span>}
                  </div>
                </div>
                <div className={`text-xs inline-flex items-center gap-1 ${a.is_connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {a.is_connected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {a.is_connected ? t('connected') : t('notConnected')}
                </div>
                {a.editable ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(a)} disabled={!!draft}><Pencil className="h-3.5 w-3.5 mr-1" />{t('edit')}</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(a)} disabled={!!draft}><Trash2 className="h-3.5 w-3.5 mr-1" />{t('delete')}</Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('readonly')}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
