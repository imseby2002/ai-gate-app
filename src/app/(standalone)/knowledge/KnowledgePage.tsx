'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalizedDepartments } from '@/lib/org-units'

interface Doc {
  id: string; department: string; title: string; source_type: string; file_name: string | null
  char_count: number; created_at: string; editable: boolean
}

export function KnowledgePage() {
  const t = useTranslations('Knowledge')
  const locale = useLocale()
  const depts = useMemo(() => getLocalizedDepartments(locale), [locale])
  const deptLabel = (k: string) => depts.find(d => d.key === k)?.label ?? k

  const [docs, setDocs] = useState<Doc[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [managed, setManaged] = useState<string[] | null>([])
  const [loading, setLoading] = useState(true)
  const [noCompany, setNoCompany] = useState(false)
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ department: '', title: '', text: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewing, setViewing] = useState<{ id: string; title: string; content: string; editable: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/knowledge')
      .then(r => { if (r.status === 403) { setNoCompany(true); return null } return r.ok ? r.json() : null })
      .then(d => {
        if (!alive || !d) return
        setDocs(d.docs); setIsAdmin(d.isCompanyAdmin); setManaged(d.managedUnits)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  const canManage = useCallback((k: string) => isAdmin || (k !== 'system' && (managed ?? []).includes(k)), [isAdmin, managed])
  const uploadDepts = depts.filter(d => canManage(d.key))

  const save = async () => {
    if (!form.department) { setMsg(t('needDept')); return }
    if (!file && !form.text.trim()) { setMsg(t('needContent')); return }
    if (!file && !form.title.trim()) { setMsg(t('needTitle')); return }
    setBusy(true); setMsg('')
    const fd = new FormData()
    fd.append('department', form.department)
    fd.append('title', form.title)
    if (file) fd.append('file', file); else fd.append('text', form.text)
    const res = await fetch('/api/knowledge', { method: 'POST', body: fd }).catch(() => null)
    setBusy(false)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok) { setMsg(d?.error === 'unsupported_type' ? t('unsupported') : t('saveFailed')); return }
    if (d.truncated) alert(t('truncated'))
    setAdding(false); setForm({ department: '', title: '', text: '' }); setFile(null)
    setReloadKey(k => k + 1)
  }

  const open = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`)
    if (!res.ok) return
    const { doc } = await res.json()
    setViewing({ id, title: doc.title, content: doc.content, editable: doc.editable })
  }

  const saveContent = async () => {
    if (!viewing) return
    setBusy(true)
    const res = await fetch(`/api/knowledge/${viewing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: viewing.title, content: viewing.content }),
    })
    setBusy(false)
    if (!res.ok) { alert(t('saveFailed')); return }
    setViewing(null); setReloadKey(k => k + 1)
  }

  const remove = async (d: Doc) => {
    if (!confirm(t('confirmDelete', { title: d.title }))) return
    const res = await fetch(`/api/knowledge/${d.id}`, { method: 'DELETE' })
    if (!res.ok) { alert(t('saveFailed')); return }
    setReloadKey(k => k + 1)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (noCompany) return <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-muted-foreground">{t('noCompany')}</div>

  const shown = filter ? docs.filter(d => d.department === filter) : docs

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/office" className="mt-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <h1 className="text-2xl font-bold">{t('title')}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t('subtitle')}</p>
            </div>
          </div>
          {uploadDepts.length > 0 && !adding && <Button onClick={() => { setAdding(true); setForm(f => ({ ...f, department: uploadDepts[0].key })) }}><Plus className="h-4 w-4 mr-1" />{t('add')}</Button>}
        </div>

        {adding && (
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t('department')}</span>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  {uploadDepts.map(d => <option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t('docTitle')}</span>
                <Input value={form.title} maxLength={200} placeholder={file ? file.name : t('docTitlePh')} onChange={e => setForm({ ...form, title: e.target.value })} />
              </label>
            </div>
            <div className="space-y-2 text-sm">
              <span className="font-medium">{t('file')}</span>
              <label className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 cursor-pointer hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                <span className="text-muted-foreground">{file ? file.name : t('filePh')}</span>
                <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                {file && <button type="button" className="ml-auto" onClick={e => { e.preventDefault(); setFile(null) }}><X className="h-4 w-4" /></button>}
              </label>
              {!file && (
                <>
                  <div className="text-xs text-muted-foreground">{t('orText')}</div>
                  <textarea rows={6} className="w-full rounded-md border bg-background p-2 text-sm" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
                </>
              )}
            </div>
            {msg && <div className="text-sm text-red-600">{msg}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdding(false)} disabled={busy}>{t('cancel')}</Button>
              <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('')} className={`px-3 py-1 rounded-full text-xs border ${!filter ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>{t('all')} ({docs.length})</button>
          {depts.filter(d => docs.some(x => x.department === d.key)).map(d => (
            <button key={d.key} onClick={() => setFilter(d.key)} className={`px-3 py-1 rounded-full text-xs border ${filter === d.key ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
              {d.icon} {d.label} ({docs.filter(x => x.department === d.key).length})
            </button>
          ))}
        </div>

        {!shown.length && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t('empty')}</div>}
        <div className="space-y-2">
          {shown.map(d => (
            <div key={d.id} className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <button className="flex-1 min-w-[12rem] text-left" onClick={() => open(d.id)}>
                <div className="font-medium text-sm">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {deptLabel(d.department)} · {t('chars', { n: d.char_count.toLocaleString() })} · {new Date(d.created_at).toLocaleDateString(locale)}
                  {d.file_name ? ` · ${d.file_name}` : ''}
                </div>
              </button>
              {d.editable && <Button size="sm" variant="outline" onClick={() => remove(d)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          ))}
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center gap-2">
              {viewing.editable
                ? <Input value={viewing.title} onChange={e => setViewing({ ...viewing, title: e.target.value })} />
                : <div className="font-semibold flex-1">{viewing.title}</div>}
              <button onClick={() => setViewing(null)}><X className="h-5 w-5" /></button>
            </div>
            <textarea className="flex-1 min-h-[50vh] p-4 text-sm bg-background outline-none" readOnly={!viewing.editable}
              value={viewing.content} onChange={e => setViewing({ ...viewing, content: e.target.value })} />
            {viewing.editable && (
              <div className="p-3 border-t flex justify-end">
                <Button onClick={saveContent} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
