'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus, Trash2, Mail, Loader2, Building2, Edit3, Check, X, ShieldCheck, UserPlus, KeyRound, Eye, EyeOff
} from 'lucide-react'

export interface WhitelistEntry {
  id: string
  email: string
  note: string | null
  company_id?: string | null
  companies?: any
  company?: any
  added_at: string
  registered?: boolean
}

interface Props {
  entries?: WhitelistEntry[]
  companies?: { id: string; name: string }[]
  currentCompany?: { id: string; name: string } | null
  mode?: 'admin' | 'company'
  onRefresh?: () => void
}

export function EmployeeWhitelistManager({
  entries: initialEntries,
  companies = [],
  currentCompany = null,
  mode = 'admin',
  onRefresh,
}: Props) {
  const router = useRouter()
  const t = useTranslations('Settings.whitelist')
  const isCompanyMode = mode === 'company' || !!currentCompany

  const [entries, setEntries] = useState<WhitelistEntry[]>(initialEntries ?? [])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    currentCompany?.id ?? ''
  )
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 編輯備註狀態
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // 編輯所屬公司狀態
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [savingCompany, setSavingCompany] = useState(false)

  // 同步外部 initialEntries
  useEffect(() => {
    if (initialEntries) {
      setEntries(initialEntries)
    }
  }, [initialEntries])

  // 公司端自動載入資料（若未傳入 initialEntries）
  const loadCompanyData = async () => {
    if (!isCompanyMode) return
    setLoading(true)
    try {
      const res = await fetch('/api/company/employee-whitelist')
      if (res.ok) {
        const d = await res.json()
        setEntries(d.entries ?? [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isCompanyMode && !initialEntries) {
      loadCompanyData()
    }
  }, [isCompanyMode])

  // 公司員工初始密碼（免註冊建帳號用）
  const [initPw, setInitPw] = useState<string | null>(null)
  const [initPwLoaded, setInitPwLoaded] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [editingPw, setEditingPw] = useState(false)
  const [pwDraft, setPwDraft] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [skipSignup, setSkipSignup] = useState(true)
  useEffect(() => {
    if (!isCompanyMode) return
    fetch('/api/company/employee-whitelist/initial-password').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setInitPw(d.password ?? null) }).finally(() => setInitPwLoaded(true))
  }, [isCompanyMode])
  const saveInitPw = async () => {
    if (pwDraft.length < 8) { setError(t('initPwTooShort')); return }
    setSavingPw(true); setError('')
    const res = await fetch('/api/company/employee-whitelist/initial-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwDraft }) })
    const d = await res.json().catch(() => ({}))
    setSavingPw(false)
    if (!res.ok) { setError(d.error ?? 'error'); return }
    setInitPw(pwDraft); setEditingPw(false); setPwDraft('')
  }

  // 為未註冊者直接建立帳號（免註冊，用公司初始密碼）
  const [provisioning, setProvisioning] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const unregistered = entries.filter(e => e.registered === false)
  const provision = async (emails?: string[]) => {
    if (!initPw) { setError(t('initPwNeeded')); setEditingPw(true); return }
    const n = emails?.length ?? unregistered.length
    if (!confirm(t('provisionConfirm', { n }))) return
    setProvisioning(true); setError('')
    const res = await fetch('/api/company/employee-whitelist/provision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emails ? { emails } : {}) })
    const d = await res.json().catch(() => ({}))
    setProvisioning(false)
    if (!res.ok) { setError(d.error === 'no_initial_password' ? t('initPwNeeded') : d.error ?? 'error'); return }
    alert(t('provisionDone', { created: d.created?.length ?? 0, failed: d.failed?.length ?? 0 }) + (d.failed?.length ? '\n' + d.failed.map((f: { email: string; error: string }) => `${f.email}: ${f.error}`).join('\n') : ''))
    setPicked(new Set())
    loadCompanyData()
  }

  const apiEndpoint = isCompanyMode
    ? '/api/company/employee-whitelist'
    : '/api/admin/employee-whitelist'

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    setError('')

    const payload: Record<string, unknown> = {
      email: email.trim(),
      note: note.trim() || null,
    }

    if (!isCompanyMode) {
      payload.company_id = selectedCompanyId || null
    } else if (skipSignup && initPw) {
      payload.provision = true
    }

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const d = await res.json().catch(() => ({}))
      if (d.provisionError) alert(t('provisionDone', { created: 0, failed: 1 }) + '\n' + d.provisionError)
      setEmail('')
      setNote('')
      if (isCompanyMode) {
        await loadCompanyData()
      } else {
        router.refresh()
      }
      if (onRefresh) onRefresh()
    } else {
      const data = await res.json()
      setError(data.error === 'Email already in whitelist' ? t('exists') : data.error === 'no_initial_password' ? t('initPwNeeded') : data.error)
    }
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmRemove'))) return
    setDeletingId(id)
    await fetch(apiEndpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (isCompanyMode) {
      await loadCompanyData()
    } else {
      router.refresh()
    }
    if (onRefresh) onRefresh()
    setDeletingId(null)
  }

  // 開始編輯備註
  const startEditNote = (entry: WhitelistEntry) => {
    setEditingId(entry.id)
    setEditingNote(entry.note ?? '')
  }

  // 儲存修改後的備註
  const handleSaveNote = async (id: string) => {
    setSavingNote(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, note: editingNote.trim() || null }),
      })
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === id ? { ...e, note: editingNote.trim() || null } : e))
        setEditingId(null)
      } else {
        const d = await res.json()
        alert(d.error ?? t('noteFailed'))
      }
    } catch (err: any) {
      alert(err.message)
    }
    setSavingNote(false)
  }

  // 儲存修改後的所屬公司
  const handleSaveCompany = async (id: string, newCompanyId: string) => {
    setSavingCompany(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, company_id: newCompanyId || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        const rawComp = updated.companies || updated.company
        const companyObj = Array.isArray(rawComp) ? rawComp[0] : rawComp
        setEntries(prev => prev.map(e => e.id === id
          ? { ...e, company_id: newCompanyId || null, companies: companyObj, company: companyObj }
          : e
        ))
        setEditingCompanyId(null)
      } else {
        const d = await res.json()
        alert(d.error ?? t('companyFailed'))
      }
    } catch (err: any) {
      alert(err.message)
    }
    setSavingCompany(false)
  }

  return (
    <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {isCompanyMode ? (
              <>
                <Building2 className="h-5 w-5 text-indigo-600" />
                {t('titleCompany', { name: currentCompany?.name ?? t('ourCompany') })}
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-primary" />
                {t('title')}
              </>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isCompanyMode
              ? t('descCompany', { name: currentCompany?.name ?? t('ourCompany') })
              : t('descAdmin')}
          </p>
        </div>
        {isCompanyMode && currentCompany && (
          <div className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200">
            {t('fixedCompany', { name: currentCompany.name })}
          </div>
        )}
      </div>

      {isCompanyMode && initPwLoaded && (
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 text-sm">
          <KeyRound className="h-4 w-4 text-indigo-600" />
          <span className="font-medium">{t('initPw')}</span>
          {editingPw ? (
            <>
              <input type="text" value={pwDraft} onChange={e => setPwDraft(e.target.value)} placeholder={t('initPwPh')} autoComplete="off"
                className="h-8 w-48 px-2 rounded-lg border bg-white dark:bg-background text-sm font-mono outline-none focus:ring-2" />
              <button type="button" onClick={saveInitPw} disabled={savingPw} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50">
                {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('save')}
              </button>
              <button type="button" onClick={() => { setEditingPw(false); setPwDraft('') }} className="h-8 px-3 rounded-lg border text-xs">{t('cancel')}</button>
            </>
          ) : initPw ? (
            <>
              <span className="font-mono text-gray-700 dark:text-gray-200">{showPw ? initPw : '••••••••'}</span>
              <button type="button" onClick={() => setShowPw(v => !v)} className="p-1 text-gray-400 hover:text-gray-600" title={showPw ? t('hide') : t('show')}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => { setEditingPw(true); setPwDraft('') }} className="h-7 px-2.5 rounded-lg border text-xs">{t('initPwChange')}</button>
            </>
          ) : (
            <>
              <span className="text-amber-700">{t('initPwNotSet')}</span>
              <button type="button" onClick={() => setEditingPw(true)} className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-medium">{t('initPwSet')}</button>
            </>
          )}
          <span className="basis-full text-xs text-gray-500">{t('initPwHint')}</span>
        </div>
      )}

      {isCompanyMode && unregistered.length > 0 && (
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-amber-50/60 text-sm">
          <span className="text-amber-800">{t('unregisteredCount', { n: unregistered.length })}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => provision([...picked])} disabled={provisioning || picked.size === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-xs font-medium disabled:opacity-50">
              <UserPlus className="h-3.5 w-3.5" />{t('provisionPicked', { n: picked.size })}
            </button>
            <button type="button" onClick={() => provision()} disabled={provisioning}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50">
              {provisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}{t('provisionButton')}
            </button>
          </div>
        </div>
      )}

      {/* 新增表單 */}
      <form onSubmit={handleAdd} className="p-5 border-b bg-gray-50/70 dark:bg-muted/30 flex flex-wrap gap-3 items-end">
        {/* Email 輸入框 */}
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('email')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="employee@company.com"
              required
              className="w-full pl-9 pr-3 h-9 rounded-lg border bg-white dark:bg-background text-sm outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* 所屬公司：總管理端可選，公司端固定顯示 */}
        {!isCompanyMode ? (
          <div className="flex-1 min-w-44">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('companyAdmin')}
            </label>
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-background text-sm outline-none focus:ring-2 cursor-pointer"
            >
              <option value="">{t('allPlatform')}</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              {t('company')}
            </label>
            <div className="w-full h-9 px-3 rounded-lg border bg-gray-100 dark:bg-muted text-gray-500 flex items-center text-sm">
              {currentCompany?.name ?? t('ourCompany')}
            </div>
          </div>
        )}

        {/* 備註輸入框 */}
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('noteOptional')}</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('notePh')}
            className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-background text-sm outline-none focus:ring-2"
          />
        </div>

        {isCompanyMode && (
          <label className="h-9 flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer" title={initPw ? t('skipSignupTip') : t('initPwNeeded')}>
            <input type="checkbox" checked={skipSignup && !!initPw} disabled={!initPw} onChange={e => setSkipSignup(e.target.checked)} />
            {t('skipSignup')}
          </label>
        )}
        <button
          type="submit"
          disabled={adding}
          className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-60 bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('add')}
        </button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </form>

      {/* 清單表格 */}
      <div>
        {loading ? (
          <div className="py-12 flex items-center justify-center text-gray-400 text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {t('empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-muted/40">
                  <th className="text-left px-5 py-2.5 font-medium text-gray-500">Email</th>
                  {!isCompanyMode && (
                    <th className="text-left px-5 py-2.5 font-medium text-gray-500">{t('company')}</th>
                  )}
                  <th className="text-left px-5 py-2.5 font-medium text-gray-500">
                    {t('note')} <span className="text-[11px] text-gray-400 font-normal">{t('editable')}</span>
                  </th>
                  <th className="text-left px-5 py-2.5 font-medium text-gray-500">{t('addedAt')}</th>
                  <th className="px-5 py-2.5 text-right font-medium text-gray-500">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const rawComp = entry.companies || entry.company
                  const companyObj = Array.isArray(rawComp) ? rawComp[0] : rawComp
                  const isEditingThis = editingId === entry.id

                  return (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-gray-50/80 dark:hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {isCompanyMode && entry.registered === false && (
                          <input type="checkbox" className="mr-2 align-middle" title={t('skipSignup')}
                            checked={picked.has(entry.email)}
                            onChange={e => setPicked(prev => { const n = new Set(prev); if (e.target.checked) n.add(entry.email); else n.delete(entry.email); return n })} />
                        )}
                        {entry.email}
                        {entry.registered !== undefined && (
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${entry.registered ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                            {entry.registered ? t('registered') : t('notRegistered')}
                          </span>
                        )}
                      </td>

                      {!isCompanyMode && (
                        <td className="px-5 py-3">
                          {editingCompanyId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                autoFocus
                                defaultValue={entry.company_id ?? ''}
                                disabled={savingCompany}
                                onChange={e => handleSaveCompany(entry.id, e.target.value)}
                                onBlur={() => setEditingCompanyId(null)}
                                className="h-7 px-2 text-xs rounded border bg-white dark:bg-background outline-none focus:ring-1"
                              >
                                <option value="">{t('global')}</option>
                                {companies.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              {savingCompany && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingCompanyId(entry.id)}
                              className="group/comp flex items-center gap-1.5 cursor-pointer"
                              title={t('editCompany')}
                            >
                              {companyObj?.name ? (
                                <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                  {companyObj.name}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">{t('global')}</span>
                              )}
                              <Edit3 className="h-3 w-3 opacity-0 group-hover/comp:opacity-100 text-gray-400 transition-opacity shrink-0" />
                            </div>
                          )}
                        </td>
                      )}

                      {/* 備註欄位：支援即時編輯更改 */}
                      <td className="px-5 py-3">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 max-w-xs">
                            <input
                              type="text"
                              value={editingNote}
                              onChange={e => setEditingNote(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveNote(entry.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                              placeholder={t('notePh2')}
                              className="h-7 px-2 text-xs rounded border bg-white dark:bg-background outline-none focus:ring-1 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNote(entry.id)}
                              disabled={savingNote}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title={t('save')}
                            >
                              {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title={t('cancel')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditNote(entry)}
                            className="group/note flex items-center gap-1.5 cursor-pointer max-w-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors"
                            title={t('editNote')}
                          >
                            <span>{entry.note || '—'}</span>
                            <Edit3 className="h-3 w-3 opacity-0 group-hover/note:opacity-100 text-gray-400 transition-opacity shrink-0" />
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(entry.added_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors p-1"
                          title={t('remove')}
                        >
                          {deletingId === entry.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
