'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Copy, Check, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
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
}

interface CsFormSubmission {
  id: string
  answers: Record<string, string>
  room_ref: string | null
  source: string
  platform: string | null
  created_at: string
}

const FIELD_TYPES: { value: CsFormField['type']; label: string }[] = [
  { value: 'text', label: '單行文字' },
  { value: 'textarea', label: '多行文字' },
  { value: 'select', label: '下拉選單' },
  { value: 'radio', label: '單選按鈕' },
  { value: 'number', label: '數字' },
]

function emptyField(): CsFormField {
  return { id: Math.random().toString(36).slice(2, 9), label: '', type: 'text', required: false }
}

function emptyNotifyTarget(): CsFormNotifyTarget {
  return { platform: '', to: '', batchMode: 'daily', batchTime: '08:00' }
}

export function CsFormsPanel({ industry, appUrl }: { industry: string; appUrl: string }) {
  const [forms, setForms] = useState<CsForm[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [expandedSubs, setExpandedSubs] = useState<string | null>(null)
  const [subs, setSubs] = useState<CsFormSubmission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)

  const [name, setName] = useState('')
  const [fields, setFields] = useState<CsFormField[]>([emptyField()])
  const [triggerKeywords, setTriggerKeywords] = useState('')
  const [notifyTarget, setNotifyTarget] = useState<CsFormNotifyTarget>(emptyNotifyTarget())
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
    setError(''); setEditingId(null); setCreating(false)
  }

  const startCreate = () => { resetEditor(); setCreating(true) }

  const startEdit = (f: CsForm) => {
    setName(f.name); setFields(f.fields.length ? f.fields : [emptyField()])
    setTriggerKeywords(f.trigger_keywords)
    setNotifyTarget(f.notify_target?.platform !== undefined ? f.notify_target : emptyNotifyTarget())
    setError(''); setEditingId(f.id); setCreating(false)
  }

  const save = async () => {
    if (!name.trim()) { setError('請輸入表單名稱'); return }
    const cleanFields = fields.filter(f => f.label.trim())
    if (!cleanFields.length) { setError('至少需要一個欄位'); return }
    setSaving(true); setError('')
    try {
      const body = { name: name.trim(), fields: cleanFields, triggerKeywords, notifyTarget, industry }
      const res = editingId
        ? await fetch(`/api/marketing/cs-forms/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/marketing/cs-forms', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '儲存失敗'); return }
      resetEditor()
      loadForms()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('確定刪除這份表單？相關的提交紀錄也會一併刪除。')) return
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

  const updateField = (idx: number, patch: Partial<CsFormField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const editorOpen = creating || editingId

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">自建表單</div>
          <div className="text-xs text-gray-400 mt-0.5">客人掃碼或點連結即可填寫送出，送出結果會通知到您指定的對象</div>
        </div>
        {!editorOpen && (
          <button onClick={startCreate}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
            style={{ background: 'var(--primary)' }}>
            <Plus className="h-3.5 w-3.5" />新增表單
          </button>
        )}
      </div>

      {editorOpen && (
        <div className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">表單名稱</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="例如：早餐訂購表單"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">觸發關鍵字（CS 對話中提到時會主動詢問，逗號分隔，選填）</label>
            <input value={triggerKeywords} onChange={e => setTriggerKeywords(e.target.value)}
              placeholder="例如：早餐,早餐訂購"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500">表單欄位</label>
            {fields.map((f, idx) => (
              <div key={f.id} className="border rounded-lg p-2.5 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })}
                    placeholder="欄位名稱，例如：早餐選擇"
                    className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
                  <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as CsFormField['type'] })}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                    必填
                  </label>
                  <button onClick={() => setFields(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(f.type === 'select' || f.type === 'radio') && (
                  <input value={(f.options ?? []).join(',')}
                    onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="選項，逗號分隔，例如：麥當勞,早餐直送"
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500" />
                )}
              </div>
            ))}
            <button onClick={() => setFields(prev => [...prev, emptyField()])}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <Plus className="h-3 w-3" />新增欄位
            </button>
          </div>

          <div className="border rounded-lg p-2.5 bg-white space-y-2">
            <label className="block text-xs font-medium text-gray-500">送出後通知</label>
            <div className="flex gap-2">
              <select value={notifyTarget.platform}
                onChange={e => setNotifyTarget(prev => ({ ...prev, platform: e.target.value as CsFormNotifyTarget['platform'] }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">不通知</option>
                <option value="line">LINE（個人或群組）</option>
                <option value="email">Email</option>
              </select>
              {notifyTarget.platform && (
                <input value={notifyTarget.to} onChange={e => setNotifyTarget(prev => ({ ...prev, to: e.target.value }))}
                  placeholder={notifyTarget.platform === 'line' ? 'LINE 使用者或群組 ID' : 'Email 地址'}
                  className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
              )}
            </div>
            {notifyTarget.platform && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={notifyTarget.batchMode === 'daily'}
                    onChange={() => setNotifyTarget(prev => ({ ...prev, batchMode: 'daily' }))} />
                  每日彙整一次
                </label>
                {notifyTarget.batchMode === 'daily' && (
                  <input type="time" value={notifyTarget.batchTime}
                    onChange={e => setNotifyTarget(prev => ({ ...prev, batchTime: e.target.value }))}
                    className="rounded border border-gray-300 px-1.5 py-1 text-xs" />
                )}
                <label className="flex items-center gap-1">
                  <input type="radio" checked={notifyTarget.batchMode === 'immediate'}
                    onChange={() => setNotifyTarget(prev => ({ ...prev, batchMode: 'immediate' }))} />
                  每筆立即通知
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button onClick={resetEditor} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
              取消
            </button>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />載入中...</div>}

      {!loading && forms.length === 0 && !editorOpen && (
        <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
          <div className="mb-2">還沒有自建表單</div>
          <div className="text-xs">建立表單後可以生成公開連結，客人掃碼或點連結即可填寫送出</div>
        </div>
      )}

      {forms.length > 0 && (
        <div className="space-y-2">
          {forms.map(f => (
            <div key={f.id} className="border rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{f.name}</span>
                  {!f.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 border">已停用</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => copyLink(f.slug)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                    {copiedSlug === f.slug ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    複製連結
                  </button>
                  <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer"
                    className="text-gray-400 hover:text-gray-600 p-1"><ExternalLink className="h-3.5 w-3.5" /></a>
                  <button onClick={() => toggleEnabled(f)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                    {f.enabled ? '停用' : '啟用'}
                  </button>
                  <button onClick={() => startEdit(f)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">編輯</button>
                  <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <button onClick={() => toggleSubs(f.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                {expandedSubs === f.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                查看提交紀錄
              </button>

              {expandedSubs === f.id && (
                <div className="border-t pt-2 space-y-1.5">
                  {subsLoading && <div className="text-xs text-gray-400">載入中...</div>}
                  {!subsLoading && subs.length === 0 && <div className="text-xs text-gray-400">尚無提交紀錄</div>}
                  {!subsLoading && subs.map(s => (
                    <div key={s.id} className="text-xs bg-gray-50 rounded-lg p-2 space-y-0.5">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>{new Date(s.created_at).toLocaleString('zh-TW')}</span>
                        {s.room_ref && <span className="px-1.5 py-0.5 rounded bg-gray-100 border">房號/訂單：{s.room_ref}</span>}
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 border">{s.source === 'public_form' ? '掃碼填寫' : 'CS 對話'}</span>
                      </div>
                      <div className="text-gray-600">
                        {f.fields.map(field => s.answers[field.id] ? (
                          <div key={field.id}>{field.label}：{s.answers[field.id]}</div>
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
