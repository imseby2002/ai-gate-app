'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus, Trash2, Mail, Loader2, Building2, Edit3, Check, X, ShieldCheck
} from 'lucide-react'

export interface WhitelistEntry {
  id: string
  email: string
  note: string | null
  company_id?: string | null
  companies?: any
  company?: any
  added_at: string
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
    }

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
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
      setError(data.error === 'Email already in whitelist' ? t('exists') : data.error)
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
                        {entry.email}
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
