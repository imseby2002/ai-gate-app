'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Loader2, Sparkles, FileText, Upload, X, ClipboardCopy, Check,
  Brain, Pencil, Mail, FileCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────
type Phase = 'idle' | 'analyzing' | 'writing' | 'done' | 'error'
type Tab   = 'resume' | 'cover-letter'

interface Template {
  id: string
  name: string
  description: string
  category: string
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

const CATEGORY_COLORS: Record<string, string> = {
  formal:          'bg-blue-50 text-blue-700',
  creative:        'bg-purple-50 text-purple-700',
  'career-change': 'bg-orange-50 text-orange-700',
  'entry-level':   'bg-green-50 text-green-700',
  executive:       'bg-gray-100 text-gray-700',
}

// ─── Small components ────────────────────────────────────────────
function FileTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs bg-gray-50 text-gray-700 max-w-[220px]">
      <FileText className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="truncate">{name}</span>
      <button type="button" onClick={onRemove} className="shrink-0 text-gray-400 hover:text-gray-600">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function PhaseIndicator({ phase }: { phase: Phase }) {
  if (phase === 'idle') return null
  const steps: Array<{ key: Phase; icon: React.ElementType; label: string; desc: string }> = [
    { key: 'analyzing', icon: Brain,  label: 'DeepSeek-R1 分析', desc: '比對 JD 關鍵字與經歷落差' },
    { key: 'writing',   icon: Pencil, label: 'Claude Sonnet 生成', desc: '撰寫 ATS 優化履歷' },
  ]
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50 mb-4">
      {steps.map((step, i) => {
        const Icon = step.icon
        const isActive = phase === step.key
        const isDone = (step.key === 'analyzing' && (phase === 'writing' || phase === 'done')) ||
                       (step.key === 'writing' && phase === 'done')
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={isActive ? { background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }
                : isDone ? { background: '#dcfce7', color: '#16a34a' }
                : { background: '#f3f4f6', color: '#9ca3af' }}>
              {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate"
                style={isActive ? { color: 'var(--primary)' } : isDone ? { color: '#16a34a' } : { color: '#9ca3af' }}>
                {step.label}
              </p>
              <p className="text-xs text-gray-400 truncate hidden sm:block">{step.desc}</p>
            </div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-gray-300 shrink-0 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

function ResultPanel({
  result, phase, loading, emptyIcon, emptyTitle, emptyDesc, loadingLabel,
}: {
  result: string; phase: Phase; loading: boolean
  emptyIcon: React.ReactNode; emptyTitle: string; emptyDesc: React.ReactNode; loadingLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Card className="rounded-2xl shadow-sm lg:sticky lg:top-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">AI 生成結果</CardTitle>
            <CardDescription className="mt-1">生成內容將顯示於此</CardDescription>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5 text-xs">
              {copied ? <><Check className="h-3.5 w-3.5 text-green-600" />已複製</> : <><ClipboardCopy className="h-3.5 w-3.5" />複製</>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && !result && (
          <div className="space-y-3 animate-pulse">
            {[100, 80, 90, 60, 75, 85, 55].map((w, i) => (
              <div key={i} className="h-3 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {result && (
          <div className="min-h-[300px]">
            <Textarea readOnly value={result} rows={22}
              className="resize-none text-sm leading-relaxed bg-gray-50 cursor-default focus-visible:ring-0 border-gray-200" />
            {loading && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />{loadingLabel}
              </p>
            )}
          </div>
        )}
        {!loading && !result && (
          <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 text-center rounded-xl border-2 border-dashed border-gray-200 p-8">
            {emptyIcon}
            <div>
              <p className="text-sm font-medium text-gray-700">{emptyTitle}</p>
              <p className="text-xs text-gray-400 mt-1">{emptyDesc}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Resume Optimizer Tab ────────────────────────────────────────
function ResumeTab() {
  const [jd, setJd] = useState('')
  const [experience, setExperience] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]; setFileError('')
    if (!selected) return
    if (!ACCEPTED_TYPES.includes(selected.type)) { setFileError('僅支援 JPG、PDF、Word 檔案格式'); e.target.value = ''; return }
    if (selected.size > 10 * 1024 * 1024) { setFileError('檔案大小不可超過 10 MB'); e.target.value = ''; return }
    setFile(selected)
  }

  const handleSubmit = async () => {
    if (!jd.trim() && !experience.trim()) return
    setPhase('analyzing'); setError(''); setResult('')
    try {
      const formData = new FormData()
      formData.append('jd', jd); formData.append('experience', experience)
      if (file) formData.append('resume', file)
      const res = await fetch('/api/resume/optimize', { method: 'POST', body: formData })
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error((d as {error?:string}).error ?? `HTTP ${res.status}`) }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (raw === '[DONE]') break
          try {
            const ev = JSON.parse(raw) as { type:string; phase?:Phase; content?:string; error?:string }
            if (ev.type === 'phase' && ev.phase)        setPhase(ev.phase)
            else if (ev.type === 'delta' && ev.content) setResult(p => p + ev.content)
            else if (ev.type === 'done')                 setPhase('done')
            else if (ev.type === 'error')                throw new Error(ev.error)
          } catch { /* ignore */ }
        }
      }
    } catch (err) { setPhase('error'); setError(String(err)) }
  }

  const isLoading = phase === 'analyzing' || phase === 'writing'
  const canSubmit = (jd.trim().length > 0 || experience.trim().length > 0) && !isLoading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">輸入資料</CardTitle>
          <CardDescription>填寫越詳細，優化結果越精準</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">目標職缺 JD <span className="text-red-500">*</span></label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={6} disabled={isLoading}
              placeholder={'貼上職缺描述（Job Description）…\n\n例如：\n- 負責產品數據分析與報表\n- 需具備 SQL、Python 技能\n- 3 年以上相關工作經驗'}
              className="resize-none text-sm leading-relaxed" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">過往經歷 <span className="text-red-500">*</span></label>
            <Textarea value={experience} onChange={e => setExperience(e.target.value)} rows={6} disabled={isLoading}
              placeholder={'描述您的工作經歷、技能與成就…\n\n例如：\n- 2021–2024 ABC 公司，數據分析師\n- 使用 Python 建立自動化報表系統\n- 帶領 3 人小組完成季度專案'}
              className="resize-none text-sm leading-relaxed" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">上傳現有履歷 <span className="text-xs text-gray-400 font-normal ml-1">（選填）</span></label>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors"
              style={isLoading ? { opacity:.5, pointerEvents:'none', cursor:'default' }
                : file ? { borderColor:'var(--primary)', background:'color-mix(in oklch, var(--primary) 4%, transparent)', cursor:'pointer' }
                : { cursor:'pointer' }}
              onClick={() => !isLoading && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.pdf,.doc,.docx" className="sr-only" onChange={handleFileChange} disabled={isLoading} />
              {file ? <div onClick={e => e.stopPropagation()}><FileTag name={file.name} onRemove={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} /></div>
                : <><Upload className="h-5 w-5 text-gray-400" /><p className="text-xs text-gray-500 text-center">點擊上傳或拖曳檔案至此<br /><span className="text-gray-400">支援 JPG · PDF · Word（最大 10 MB）</span></p></>}
            </div>
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          </div>
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />處理中，請稍候…</> : <><Sparkles className="h-4 w-4" />開始優化</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <PhaseIndicator phase={phase} />
        <ResultPanel result={result} phase={phase} loading={isLoading} loadingLabel="Claude Sonnet 撰寫中…"
          emptyIcon={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Brain className="h-5 w-5 text-blue-500" /></div>
              <div className="text-gray-300 text-lg font-light">→</div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
                <Pencil className="h-5 w-5" style={{ color:'var(--primary)' }} />
              </div>
            </div>}
          emptyTitle="雙模型協作" emptyDesc={<>DeepSeek-R1 分析落差<br />Claude Sonnet 撰寫優化履歷</>} />
      </div>
    </div>
  )
}

// ─── Cover Letter Tab ────────────────────────────────────────────
function CoverLetterTab() {
  const [jd, setJd] = useState('')
  const [experience, setExperience] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/resume/templates')
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setTemplatesLoading(false) })
      .catch(() => setTemplatesLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!jd.trim() && !experience.trim()) return
    setPhase('writing'); setError(''); setResult('')
    try {
      const res = await fetch('/api/resume/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, experience, templateId: selectedTemplate, customInstructions }),
      })
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error((d as {error?:string}).error ?? `HTTP ${res.status}`) }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (raw === '[DONE]') break
          try {
            const ev = JSON.parse(raw) as { type:string; content?:string; error?:string }
            if (ev.type === 'delta' && ev.content) setResult(p => p + ev.content)
            else if (ev.type === 'done')             setPhase('done')
            else if (ev.type === 'error')            throw new Error(ev.error)
          } catch { /* ignore */ }
        }
      }
    } catch (err) { setPhase('error'); setError(String(err)) }
  }

  const isLoading = phase === 'writing'
  const canSubmit = (jd.trim().length > 0 || experience.trim().length > 0) && !isLoading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">輸入資料</CardTitle>
          <CardDescription>選擇模板並填寫 JD 與經歷</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Template selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">選擇求職信模板</label>
            {templatesLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />載入模板中…</div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">尚無可用模板（管理員可至後台新增）</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {/* No template option */}
                <button type="button" onClick={() => setSelectedTemplate('')}
                  className="text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm"
                  style={!selectedTemplate ? { borderColor:'var(--primary)', background:'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                  <div className="font-medium text-sm">自由發揮（不使用模板）</div>
                  <div className="text-xs text-gray-400 mt-0.5">由 AI 自主決定最適合的求職信結構</div>
                </button>
                {templates.map(t => (
                  <button key={t.id} type="button" onClick={() => setSelectedTemplate(t.id)}
                    className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                    style={selectedTemplate === t.id ? { borderColor:'var(--primary)', background:'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.category}
                      </span>
                    </div>
                    {t.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">目標職缺 JD <span className="text-red-500">*</span></label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={5} disabled={isLoading}
              placeholder="貼上職缺描述（Job Description）…" className="resize-none text-sm leading-relaxed" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">過往經歷 <span className="text-red-500">*</span></label>
            <Textarea value={experience} onChange={e => setExperience(e.target.value)} rows={5} disabled={isLoading}
              placeholder="描述您的工作經歷、技能與成就…" className="resize-none text-sm leading-relaxed" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">額外要求 <span className="text-xs text-gray-400 font-normal ml-1">（選填）</span></label>
            <Textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} rows={2} disabled={isLoading}
              placeholder="例如：請用英文撰寫、語氣偏輕鬆、強調領導力…" className="resize-none text-sm" />
          </div>

          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中，請稍候…</> : <><Mail className="h-4 w-4" />生成求職信</>}
          </Button>
        </CardContent>
      </Card>

      <ResultPanel result={result} phase={phase} loading={isLoading} loadingLabel="Claude Sonnet 撰寫中…"
        emptyIcon={
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background:'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
            <Mail className="h-6 w-6" style={{ color:'var(--primary)' }} />
          </div>}
        emptyTitle="尚無求職信" emptyDesc={<>選擇模板並填寫 JD 與經歷<br />Claude Sonnet 將為你撰寫求職信</>} />
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function ResumePage() {
  const [tab, setTab] = useState<Tab>('resume')

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: 'resume',       label: '精準履歷優化', icon: FileCheck },
    { key: 'cover-letter', label: 'Cover Letter 生成', icon: Mail },
  ]

  return (
    <div className="px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6" style={{ color: 'var(--primary)' }} />
          打工人求職工具箱
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          AI 驅動的履歷優化 × 求職信生成，全方位提升求職競爭力
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t.key
                ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6b7280' }}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'resume'       && <ResumeTab />}
      {tab === 'cover-letter' && <CoverLetterTab />}
    </div>
  )
}
