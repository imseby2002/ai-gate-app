'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Brain, Plus, Loader2, Link2, FileText, Type, Trash2, Send,
  Crown, ArrowLeft, Upload, X,
} from 'lucide-react'
import { useMarketingPlan } from '@/components/marketing/PlanGate'

interface ExpertListItem {
  id: string
  name: string
  description: string
  sourceCount: number
  updated_at: string
}
interface ExpertSource {
  id: string
  type: 'url' | 'file' | 'text'
  name: string
  source_url: string | null
  char_count: number
}

export default function ExpertsPage() {
  const plan = useMarketingPlan()
  const canBuild = !!plan && plan.features.customExpertBuild === true

  const [experts, setExperts] = useState<ExpertListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const loadExperts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/experts')
      const data = await res.json()
      setExperts(data.experts ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadExperts() }, [loadExperts])

  if (activeId) {
    return <ExpertDetail id={activeId} canBuild={canBuild} onBack={() => { setActiveId(null); loadExperts() }} />
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">自製專家</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          餵網址、文件或文字，訓練成你這個領域的專屬顧問。問答依方案可用（點數扣款）；建立與訓練需 TEAM 以上方案。
        </p>

        {canBuild && <CreateExpert onCreated={loadExperts} />}
        {!canBuild && (
          <div className="mb-5 rounded-xl border bg-card p-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">建立自製專家需 TEAM 以上方案；你仍可使用已建立的專家提問。</p>
            <Link href="/marketing/plan" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary">
              <Crown className="h-4 w-4" />升級方案
            </Link>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : experts.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">還沒有任何專家{canBuild ? '，從上方建立第一個吧' : ''}。</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {experts.map(e => (
              <button key={e.id} onClick={() => setActiveId(e.id)}
                className="text-left rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">{e.name}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[2rem]">{e.description || '（無描述）'}</p>
                <span className="text-[11px] text-muted-foreground">{e.sourceCount} 個知識來源</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateExpert({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { alert('請輸入專家名稱'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/marketing/experts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, systemPrompt }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '建立失敗'); return }
      setName(''); setDescription(''); setSystemPrompt(''); setOpen(false)
      onCreated()
    } finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary">
        <Plus className="h-4 w-4" />建立新專家
      </button>
    )
  }

  return (
    <div className="mb-5 rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">建立新專家</h2>
        <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="專家名稱，例：民宿法規顧問"
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="一句話描述這個專家的專長（選填）"
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
      <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3}
        placeholder="人設 / 回答風格（選填，例：你是熟悉台灣民宿法規的顧問，回答務必引用條文並提醒實務注意事項）"
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
      <button onClick={submit} disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}建立
      </button>
    </div>
  )
}

function ExpertDetail({ id, canBuild, onBack }: { id: string; canBuild: boolean; onBack: () => void }) {
  const [name, setName] = useState('')
  const [sources, setSources] = useState<ExpertSource[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/experts/${id}`)
      const data = await res.json()
      if (res.ok) { setName(data.expert.name); setSources(data.sources ?? []) }
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />返回專家列表
        </button>
        <div className="flex items-center gap-2.5 mb-6">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{name || '專家'}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold">知識來源（{sources.length}）</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {sources.map(s => (
                  <SourceRow key={s.id} expertId={id} source={s} canBuild={canBuild} onDeleted={load} />
                ))}
                {sources.length === 0 && <p className="text-sm text-muted-foreground">還沒有知識來源。</p>}
              </div>
            )}
            {canBuild && <AddSource expertId={id} onAdded={load} />}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-4">向專家提問</h2>
            <AskPanel expertId={id} disabled={sources.length === 0} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceRow({ expertId, source, canBuild, onDeleted }: { expertId: string; source: ExpertSource; canBuild: boolean; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const Icon = source.type === 'url' ? Link2 : source.type === 'file' ? FileText : Type
  const del = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/experts/${expertId}/sources/${source.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally { setDeleting(false) }
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm truncate flex-1">{source.name}</span>
      <span className="text-[11px] text-muted-foreground shrink-0">{source.char_count.toLocaleString()} 字</span>
      {canBuild && (
        <button onClick={del} disabled={deleting} className="shrink-0 text-muted-foreground hover:text-red-500">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

function AddSource({ expertId, onAdded }: { expertId: string; onAdded: () => void }) {
  const [tab, setTab] = useState<'url' | 'text' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/marketing/experts/${expertId}/sources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '加入失敗'); return false }
      onAdded()
      return true
    } finally { setBusy(false) }
  }

  const addUrl = async () => { if (url.trim() && await post({ type: 'url', url })) setUrl('') }
  const addText = async () => { if (text.trim() && await post({ type: 'text', text })) setText('') }

  const addFile = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file); form.append('category', 'document')
      const up = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const upData = await up.json()
      if (!up.ok) { alert(upData.error ?? '上傳失敗'); return }
      if (!upData.textContent) { alert('此檔案無法萃取文字內容'); return }
      await post({ type: 'file', name: upData.name, text: upData.textContent, url: upData.url })
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex gap-1 text-xs">
        {([['url', '網址', Link2], ['text', '貼上文字', Type], ['file', '上傳檔案', Upload]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium ${tab === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      {tab === 'url' && (
        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm" />
          <button onClick={addUrl} disabled={busy || !url.trim()}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '抓取'}
          </button>
        </div>
      )}
      {tab === 'text' && (
        <div className="space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
            placeholder="貼上要作為知識的文字…" className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
          <button onClick={addText} disabled={busy || !text.trim()}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '加入'}
          </button>
        </div>
      )}
      {tab === 'file' && (
        <div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
            onChange={e => { const f = e.target.files?.[0]; if (f) addFile(f) }}
            className="text-sm" disabled={busy} />
          <p className="text-[11px] text-muted-foreground mt-1">支援 PDF / Word / Excel / CSV / TXT，自動萃取文字</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">加入來源會依字數扣點（網址每則 0.02＋每千字 0.01）。</p>
    </div>
  )
}

function AskPanel({ expertId, disabled }: { expertId: string; disabled: boolean }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setBusy(true); setAnswer('')
    try {
      const res = await fetch(`/api/marketing/experts/${expertId}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) { setAnswer(`⚠️ ${data.error ?? '作答失敗'}`); return }
      setAnswer(data.answer)
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {disabled && <p className="text-xs text-amber-600">請先加入至少一個知識來源，專家才有依據可作答。</p>}
      <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3}
        placeholder="輸入你的問題…" className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
      <button onClick={ask} disabled={busy || disabled || !question.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}提問（0.05 點）
      </button>
      {answer && (
        <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed">{answer}</div>
      )}
    </div>
  )
}
