'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, Sparkles, FileText, Upload, X, ClipboardCopy, Check,
  Brain, Pencil, Mail, FileCheck, ChevronDown, ChevronUp, Plus, Trash2,
  User, GraduationCap, Briefcase, Wrench, Star, ArrowLeft,
  MessageSquare, DollarSign, BarChart2, Presentation, ClipboardList,
  MessageCircle, TrendingUp, Zap, NotebookPen, Building2, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────
type Phase      = 'idle' | 'analyzing' | 'writing' | 'done' | 'error'
type InputMode  = 'upload' | 'form' | 'both'

interface EduEntry  { school: string; major: string; degree: string; period: string }
interface ExpEntry  { company: string; title: string; period: string; description: string }
interface ResumeForm {
  name: string; phone: string; email: string
  birthdate: string; gender: string; targetPosition: string
  education: EduEntry[]; certifications: string
  experience: ExpEntry[]
  skills: string; languages: string
  portfolio: string; selfIntro: string; other: string
}
interface Template { id: string; name: string; description: string; category: string }

type FieldType = 'textarea' | 'input' | 'select'
interface ToolField { key: string; label: string; type: FieldType; placeholder?: string; required?: boolean; options?: string[] }
interface ToolConfig {
  id: string
  category: 'job-search' | 'workplace' | 'advanced' | 'thinking'
  label: string
  emoji: string
  desc: string
  color: string
  fields: ToolField[]
  submitLabel: string
  custom?: boolean  // uses dedicated component
}

type Translate = ReturnType<typeof useTranslations>

// ─── Tool Configs（顯示文字以 t 解析；此處只存結構） ──────────────
interface ToolDef {
  id: string
  category: ToolConfig['category']
  emoji: string
  color: string
  custom?: boolean
  fields: { key: string; type: FieldType; required?: boolean; hasOptions?: boolean }[]
}
const TOOL_DEFS: ToolDef[] = [
  { id: 'resume-optimize',       category: 'job-search', emoji: '📄', color: 'from-blue-500 to-indigo-600', custom: true, fields: [] },
  { id: 'cover-letter',          category: 'job-search', emoji: '✉️', color: 'from-blue-400 to-cyan-500',  custom: true, fields: [] },
  { id: 'interview-practice',    category: 'job-search', emoji: '🎯', color: 'from-violet-500 to-purple-600', fields: [
    { key: 'jd', type: 'textarea', required: true }, { key: 'background', type: 'textarea' } ] },
  { id: 'salary-negotiation',    category: 'job-search', emoji: '💰', color: 'from-green-500 to-emerald-600', fields: [
    { key: 'position', type: 'input', required: true }, { key: 'currentSalary', type: 'input' }, { key: 'targetSalary', type: 'input', required: true }, { key: 'highlights', type: 'textarea' } ] },
  { id: 'resume-clinic',         category: 'job-search', emoji: '🩺', color: 'from-sky-500 to-blue-600', fields: [
    { key: 'jd', type: 'textarea', required: true }, { key: 'background', type: 'textarea', required: true }, { key: 'company', type: 'input' } ] },
  { id: 'career-advisor',        category: 'job-search', emoji: '🧭', color: 'from-cyan-500 to-teal-600', fields: [
    { key: 'situation', type: 'select', required: true, hasOptions: true }, { key: 'background', type: 'textarea', required: true }, { key: 'options', type: 'textarea' }, { key: 'concern', type: 'input' } ] },
  { id: 'email-draft',           category: 'workplace', emoji: '📧', color: 'from-orange-400 to-amber-500', fields: [
    { key: 'type', type: 'select', required: true, hasOptions: true }, { key: 'relationship', type: 'input' }, { key: 'context', type: 'textarea', required: true }, { key: 'keyPoints', type: 'textarea' } ] },
  { id: 'report-writing',        category: 'workplace', emoji: '📊', color: 'from-teal-500 to-cyan-600', fields: [
    { key: 'topic', type: 'input', required: true }, { key: 'context', type: 'textarea' }, { key: 'mainPoints', type: 'textarea', required: true }, { key: 'audience', type: 'input' } ] },
  { id: 'presentation-outline',  category: 'workplace', emoji: '🖥️', color: 'from-pink-500 to-rose-600', fields: [
    { key: 'topic', type: 'input', required: true }, { key: 'audience', type: 'input' }, { key: 'coreMessage', type: 'textarea', required: true }, { key: 'duration', type: 'input' } ] },
  { id: 'meeting-minutes',       category: 'workplace', emoji: '📝', color: 'from-slate-500 to-gray-600', fields: [
    { key: 'rawNotes', type: 'textarea', required: true } ] },
  { id: 'workplace-phrases',     category: 'advanced', emoji: '🗣️', color: 'from-red-500 to-orange-600', fields: [
    { key: 'scenario', type: 'select', required: true, hasOptions: true }, { key: 'context', type: 'textarea', required: true }, { key: 'goal', type: 'textarea' } ] },
  { id: 'workplace-relationship',category: 'advanced', emoji: '🤝', color: 'from-rose-500 to-pink-600', fields: [
    { key: 'role', type: 'select', required: true, hasOptions: true }, { key: 'situation', type: 'textarea', required: true }, { key: 'goal', type: 'textarea' } ] },
  { id: 'performance-review',    category: 'advanced', emoji: '⭐', color: 'from-yellow-500 to-amber-600', fields: [
    { key: 'position', type: 'input', required: true }, { key: 'workContent', type: 'textarea', required: true }, { key: 'achievements', type: 'textarea' }, { key: 'challenges', type: 'textarea' } ] },
  { id: 'promotion-letter',      category: 'advanced', emoji: '🚀', color: 'from-purple-500 to-violet-600', fields: [
    { key: 'positions', type: 'input', required: true }, { key: 'background', type: 'input' }, { key: 'achievements', type: 'textarea', required: true }, { key: 'reason', type: 'textarea' } ] },
  { id: 'quantify-work',         category: 'advanced', emoji: '📈', color: 'from-indigo-500 to-blue-600', fields: [
    { key: 'jobContent', type: 'textarea', required: true } ] },
  { id: 'munger-mental-models',  category: 'thinking', emoji: '🧩', color: 'from-amber-500 to-yellow-600', fields: [
    { key: 'decision', type: 'textarea', required: true }, { key: 'context', type: 'textarea' }, { key: 'options', type: 'textarea' } ] },
  { id: 'first-principles',      category: 'thinking', emoji: '⚛️', color: 'from-slate-500 to-gray-700', fields: [
    { key: 'problem', type: 'textarea', required: true }, { key: 'assumptions', type: 'textarea' } ] },
  { id: 'value-investing',       category: 'thinking', emoji: '💎', color: 'from-emerald-600 to-green-700', fields: [
    { key: 'target', type: 'input', required: true }, { key: 'info', type: 'textarea', required: true }, { key: 'concern', type: 'input' } ] },
  { id: 'antifragile-risk',      category: 'thinking', emoji: '🦢', color: 'from-zinc-600 to-slate-700', fields: [
    { key: 'decision', type: 'textarea', required: true }, { key: 'downside', type: 'textarea' } ] },
  { id: 'naval-leverage',        category: 'thinking', emoji: '🧭', color: 'from-indigo-500 to-violet-700', fields: [
    { key: 'situation', type: 'textarea', required: true }, { key: 'question', type: 'textarea', required: true } ] },
]

// 把結構 + i18n 解析為完整 ToolConfig（含翻譯後的 label/desc/fields）
function buildTool(def: ToolDef, t: Translate): ToolConfig {
  return {
    id: def.id, category: def.category, emoji: def.emoji, color: def.color, custom: def.custom,
    label: t(`tools.${def.id}.label`),
    desc: t(`tools.${def.id}.desc`),
    submitLabel: t(`tools.${def.id}.submit`),
    fields: def.fields.map(f => ({
      key: f.key, type: f.type, required: f.required,
      label: t(`tools.${def.id}.fields.${f.key}.label`),
      placeholder: f.type === 'select' ? undefined : t(`tools.${def.id}.fields.${f.key}.placeholder`),
      options: f.hasOptions ? (t.raw(`tools.${def.id}.fields.${f.key}.options`) as string[]) : undefined,
    })),
  }
}

const CATEGORY_DEFS = [
  { id: 'job-search' as const },
  { id: 'workplace' as const },
  { id: 'advanced' as const },
  { id: 'thinking' as const },
]

// ─── Constants ───────────────────────────────────────────────────
const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]
const BLANK_EDU: EduEntry  = { school: '', major: '', degree: '', period: '' }
const BLANK_EXP: ExpEntry  = { company: '', title: '', period: '', description: '' }
const BLANK_FORM: ResumeForm = {
  name: '', phone: '', email: '', birthdate: '', gender: '', targetPosition: '',
  education: [{ ...BLANK_EDU }], certifications: '',
  experience: [{ ...BLANK_EXP }],
  skills: '', languages: '',
  portfolio: '', selfIntro: '', other: '',
}
const CATEGORY_COLORS: Record<string, string> = {
  formal: 'bg-blue-50 text-blue-700', creative: 'bg-purple-50 text-purple-700',
  'career-change': 'bg-orange-50 text-orange-700', 'entry-level': 'bg-green-50 text-green-700',
  executive: 'bg-gray-100 text-gray-700',
}

// ─── Helpers ─────────────────────────────────────────────────────
function serializeForm(f: ResumeForm): string {
  const lines: string[] = []
  const add = (s: string) => lines.push(s)
  if (f.name || f.phone || f.email || f.targetPosition) {
    add('【一、基本資料】')
    if (f.name)           add(`姓名：${f.name}`)
    if (f.phone)          add(`電話：${f.phone}`)
    if (f.email)          add(`Email：${f.email}`)
    if (f.targetPosition) add(`應徵職位：${f.targetPosition}`)
    if (f.birthdate)      add(`出生年月日：${f.birthdate}`)
    if (f.gender)         add(`性別：${f.gender}`)
  }
  const validEdu = f.education.filter(e => e.school)
  if (validEdu.length) {
    add('\n【二、學歷】')
    validEdu.forEach(e =>
      add(`・${e.school}${e.major ? ' ／ ' + e.major : ''}${e.degree ? '（' + e.degree + '）' : ''}${e.period ? '　' + e.period : ''}`)
    )
  }
  if (f.certifications.trim()) { add('\n【證照與課程】'); add(f.certifications) }
  const validExp = f.experience.filter(e => e.company)
  if (validExp.length) {
    add('\n【三、工作／實習／專案經驗】')
    validExp.forEach(e => {
      add(`・${e.company}｜${e.title}${e.period ? '　' + e.period : ''}`)
      if (e.description) add(e.description)
    })
  }
  if (f.skills.trim())     { add('\n【四、專業技能】'); add(f.skills) }
  if (f.languages.trim())  { add('【語言能力】');       add(f.languages) }
  if (f.portfolio.trim())  { add('\n【五、作品集／專案成就】'); add(f.portfolio) }
  if (f.selfIntro.trim())  { add('\n【自我介紹】');     add(f.selfIntro) }
  if (f.other.trim())      { add('\n【其他加分項目】'); add(f.other) }
  return lines.join('\n')
}

async function streamSSE(
  url: string,
  body: FormData | object,
  onDelta: (t: string) => void,
  onDone: () => void,
  onPhase?: (p: Phase, label?: string) => void,
) {
  const isFormData = body instanceof FormData
  const res = await fetch(url, {
    method: 'POST',
    ...(isFormData ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (!res.ok || !res.body) {
    const d = await res.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ''
  while (true) {
    const { done, value } = await reader.read(); if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim(); if (raw === '[DONE]') break
      try {
        const ev = JSON.parse(raw) as { type: string; phase?: Phase; label?: string; content?: string; error?: string }
        if (ev.type === 'phase' && ev.phase && onPhase)  onPhase(ev.phase, ev.label)
        else if (ev.type === 'delta' && ev.content)       onDelta(ev.content)
        else if (ev.type === 'done')                       onDone()
        else if (ev.type === 'error')                      throw new Error(ev.error)
      } catch (e) { if (e instanceof Error && e.message !== 'JSON') throw e }
    }
  }
}

// ─── Small UI ────────────────────────────────────────────────────
function FieldInput({ field, value, onChange, disabled }: {
  field: ToolField; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  const t = useTranslations('Resume')
  if (field.type === 'textarea') {
    return (
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={4} disabled={disabled}
        placeholder={field.placeholder} className="resize-none text-sm" />
    )
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 disabled:opacity-50 bg-white">
        <option value="">{t('selectPlaceholder')}</option>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      placeholder={field.placeholder}
      className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 disabled:opacity-50" />
  )
}

function FileTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs bg-gray-50 text-gray-700 max-w-xs">
      <FileText className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="truncate">{name}</span>
      <button type="button" onClick={onRemove} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
    </div>
  )
}

function SectionBlock({
  icon, title, open, onToggle, children,
}: { icon: ReactNode; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

function InputEl({ value, onChange, placeholder, disabled, type = 'text', className = '' }:
  { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string; className?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:bg-gray-50 ${className}`} />
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all border-2"
      style={active
        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 8%, transparent)', color: 'var(--primary)' }
        : { borderColor: 'transparent', background: 'transparent', color: '#6b7280' }}>
      {children}
    </button>
  )
}

// ─── Result Panel ─────────────────────────────────────────────────
function ResultPanel({ result, loading, emptyIcon, emptyTitle, emptyDesc }: {
  result: string; loading: boolean
  emptyIcon: ReactNode; emptyTitle: string; emptyDesc: ReactNode
}) {
  const t = useTranslations('Resume')
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <Card className="rounded-2xl shadow-sm lg:sticky lg:top-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
            <CardDescription className="mt-1">{t('resultDesc')}</CardDescription>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5 text-xs">
              {copied ? <><Check className="h-3.5 w-3.5 text-green-600" />{t('copied')}</> : <><ClipboardCopy className="h-3.5 w-3.5" />{t('copy')}</>}
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
          <div>
            <Textarea readOnly value={result} rows={24}
              className="resize-none text-sm leading-relaxed bg-gray-50 cursor-default focus-visible:ring-0 border-gray-200" />
            {loading && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />{t('generating')}
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

// ─── Generic Tool View ────────────────────────────────────────────
function GenericToolView({ tool }: { tool: ToolConfig }) {
  const t = useTranslations('Resume')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [phase, setPhase]   = useState<Phase>('idle')
  const [result, setResult] = useState('')
  const [error, setError]   = useState('')

  const isLoading = phase === 'analyzing' || phase === 'writing'
  const set = (key: string, val: string) => setInputs(prev => ({ ...prev, [key]: val }))

  const canSubmit = tool.fields.filter(f => f.required).every(f => inputs[f.key]?.trim()) && !isLoading

  const handleSubmit = async () => {
    setPhase('writing'); setError(''); setResult('')
    try {
      await streamSSE(
        '/api/resume/worker-tools',
        { toolId: tool.id, inputs },
        (t) => setResult(prev => prev + t),
        () => setPhase('done'),
      )
    } catch (err) { setPhase('error'); setError(String(err)) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{tool.emoji}</span>{tool.label}
          </CardTitle>
          <CardDescription>{tool.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tool.fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="block text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput field={field} value={inputs[field.key] ?? ''} onChange={v => set(field.key, v)} disabled={isLoading} />
            </div>
          ))}
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />{t('aiGenerating')}</>
              : <><Sparkles className="h-4 w-4" />{tool.submitLabel}</>}
          </Button>
        </CardContent>
      </Card>
      <ResultPanel result={result} loading={isLoading}
        emptyIcon={<div className="text-4xl">{tool.emoji}</div>}
        emptyTitle={t('waitingFor', { label: tool.label })}
        emptyDesc={<>{t('genericEmptyPre', { submit: tool.submitLabel })}<br />{t('genericEmptyPost')}</>} />
    </div>
  )
}

// ─── File Upload Zone ─────────────────────────────────────────────
function FileUploadZone({ file, onFile, disabled }: { file: File | null; onFile: (f: File | null) => void; disabled?: boolean }) {
  const t = useTranslations('Resume')
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sel = e.target.files?.[0]; setError('')
    if (!sel) return
    if (!ACCEPTED_TYPES.includes(sel.type)) { setError(t('upload.onlyTypes')); e.target.value = ''; return }
    if (sel.size > 10 * 1024 * 1024) { setError(t('upload.tooLarge')); e.target.value = ''; return }
    onFile(sel)
  }
  const remove = () => { onFile(null); if (ref.current) ref.current.value = '' }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors"
        style={disabled ? { opacity: .5, pointerEvents: 'none' }
          : file ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 4%, transparent)', cursor: 'pointer' }
          : { cursor: 'pointer' }}
        onClick={() => !disabled && ref.current?.click()}>
        <input ref={ref} type="file" accept=".jpg,.jpeg,.pdf,.doc,.docx" className="sr-only" onChange={handleChange} disabled={disabled} />
        {file
          ? <div onClick={e => e.stopPropagation()}><FileTag name={file.name} onRemove={remove} /></div>
          : <>
              <Upload className="h-6 w-6 text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-600 font-medium">{t('upload.dropHint')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('upload.supports')}</p>
              </div>
            </>}
      </div>
      {file && file.type.startsWith('image/') && <p className="text-xs text-blue-600">{t('upload.imageNote')}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Structured Form ──────────────────────────────────────────────
function StructuredForm({ data, onChange, disabled }: {
  data: ResumeForm; onChange: (d: ResumeForm) => void; disabled?: boolean
}) {
  const t = useTranslations('Resume')
  const [open, setOpen] = useState<Record<string, boolean>>({ basic: true, edu: false, exp: false, skills: false, other: false })
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }))
  const set = <K extends keyof ResumeForm>(key: K, val: ResumeForm[K]) => onChange({ ...data, [key]: val })
  const setEdu = (i: number, field: keyof EduEntry, val: string) => {
    const arr = data.education.map((e, idx) => idx === i ? { ...e, [field]: val } : e)
    set('education', arr)
  }
  const setExp = (i: number, field: keyof ExpEntry, val: string) => {
    const arr = data.experience.map((e, idx) => idx === i ? { ...e, [field]: val } : e)
    set('experience', arr)
  }
  return (
    <div className="space-y-2">
      <SectionBlock icon={<User className="h-4 w-4" style={{ color: 'var(--primary)' }} />} title={t('form.basicSection')} open={open.basic} onToggle={() => toggle('basic')}>
        <div className="grid grid-cols-2 gap-2">
          <InputEl value={data.name} onChange={v => set('name', v)} placeholder={t('form.name')} disabled={disabled} />
          <InputEl value={data.phone} onChange={v => set('phone', v)} placeholder={t('form.phone')} disabled={disabled} />
          <InputEl value={data.email} onChange={v => set('email', v)} placeholder={t('form.email')} disabled={disabled} className="col-span-2" />
          <InputEl value={data.targetPosition} onChange={v => set('targetPosition', v)} placeholder={t('form.targetPosition')} disabled={disabled} className="col-span-2" />
        </div>
      </SectionBlock>
      <SectionBlock icon={<GraduationCap className="h-4 w-4 text-blue-500" />} title={t('form.eduSection')} open={open.edu} onToggle={() => toggle('edu')}>
        {data.education.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{t('form.eduN', { n: i + 1 })}</span>
              {i > 0 && <button type="button" onClick={() => set('education', data.education.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <InputEl value={e.school} onChange={v => setEdu(i, 'school', v)} placeholder={t('form.school')} disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <InputEl value={e.major} onChange={v => setEdu(i, 'major', v)} placeholder={t('form.major')} disabled={disabled} />
              <InputEl value={e.degree} onChange={v => setEdu(i, 'degree', v)} placeholder={t('form.degree')} disabled={disabled} />
            </div>
            <InputEl value={e.period} onChange={v => setEdu(i, 'period', v)} placeholder={t('form.eduPeriod')} disabled={disabled} />
          </div>
        ))}
        {data.education.length < 3 && (
          <button type="button" disabled={disabled} onClick={() => set('education', [...data.education, { ...BLANK_EDU }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />{t('form.addEdu')}
          </button>
        )}
        <Textarea value={data.certifications} onChange={e => set('certifications', e.target.value)} rows={2} disabled={disabled}
          placeholder={t('form.certs')} className="resize-none text-sm" />
      </SectionBlock>
      <SectionBlock icon={<Briefcase className="h-4 w-4 text-orange-500" />} title={t('form.expSection')} open={open.exp} onToggle={() => toggle('exp')}>
        {data.experience.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{t('form.expN', { n: i + 1 })}</span>
              {i > 0 && <button type="button" onClick={() => set('experience', data.experience.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <InputEl value={e.company} onChange={v => setExp(i, 'company', v)} placeholder={t('form.company')} disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <InputEl value={e.title} onChange={v => setExp(i, 'title', v)} placeholder={t('form.jobTitle')} disabled={disabled} />
              <InputEl value={e.period} onChange={v => setExp(i, 'period', v)} placeholder={t('form.expPeriod')} disabled={disabled} />
            </div>
            <Textarea value={e.description} onChange={ev => setExp(i, 'description', ev.target.value)} rows={3} disabled={disabled}
              placeholder={t('form.expDesc')} className="resize-none text-sm" />
          </div>
        ))}
        {data.experience.length < 5 && (
          <button type="button" disabled={disabled} onClick={() => set('experience', [...data.experience, { ...BLANK_EXP }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />{t('form.addExp')}
          </button>
        )}
      </SectionBlock>
      <SectionBlock icon={<Wrench className="h-4 w-4 text-green-500" />} title={t('form.skillsSection')} open={open.skills} onToggle={() => toggle('skills')}>
        <Textarea value={data.skills} onChange={e => set('skills', e.target.value)} rows={3} disabled={disabled}
          placeholder={t('form.skills')} className="resize-none text-sm" />
        <Textarea value={data.languages} onChange={e => set('languages', e.target.value)} rows={2} disabled={disabled}
          placeholder={t('form.languages')} className="resize-none text-sm" />
      </SectionBlock>
      <SectionBlock icon={<Star className="h-4 w-4 text-yellow-500" />} title={t('form.otherSection')} open={open.other} onToggle={() => toggle('other')}>
        <Textarea value={data.selfIntro} onChange={e => set('selfIntro', e.target.value)} rows={4} disabled={disabled}
          placeholder={t('form.selfIntro')} className="resize-none text-sm" />
        <Textarea value={data.other} onChange={e => set('other', e.target.value)} rows={2} disabled={disabled}
          placeholder={t('form.otherField')} className="resize-none text-sm" />
      </SectionBlock>
    </div>
  )
}

// ─── Phase Indicator ──────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: Phase }) {
  const t = useTranslations('Resume')
  if (phase === 'idle') return null
  const steps = [
    { key: 'analyzing' as Phase, icon: Brain,  label: t('phaseAnalyze') },
    { key: 'writing'   as Phase, icon: Pencil, label: t('phaseWrite') },
  ]
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50 mb-3">
      {steps.map((step, i) => {
        const Icon = step.icon
        const isActive = phase === step.key
        const isDone = (step.key === 'analyzing' && (phase === 'writing' || phase === 'done')) || (step.key === 'writing' && phase === 'done')
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={isActive ? { background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }
                : isDone ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f3f4f6', color: '#9ca3af' }}>
              {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <p className="text-xs font-medium" style={isActive ? { color: 'var(--primary)' } : isDone ? { color: '#16a34a' } : { color: '#9ca3af' }}>
              {step.label}
            </p>
            {i < steps.length - 1 && <div className="w-5 h-px bg-gray-300 shrink-0 ml-auto" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Resume Optimizer (custom) ────────────────────────────────────
function ResumeOptimizeView() {
  const t = useTranslations('Resume')
  const [mode, setMode]         = useState<InputMode>('form')
  const [jd, setJd]             = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const [formData, setFormData] = useState<ResumeForm>({ ...BLANK_FORM })
  const [phase, setPhase]       = useState<Phase>('idle')
  const [result, setResult]     = useState('')
  const [error, setError]       = useState('')
  const isLoading = phase === 'analyzing' || phase === 'writing'
  const hasContent = () => {
    if (mode === 'upload') return !!file
    if (mode === 'form')   return !!serializeForm(formData).trim()
    return !!file || !!serializeForm(formData).trim()
  }
  const handleSubmit = async () => {
    if (!jd.trim() && !hasContent()) return
    setPhase('analyzing'); setError(''); setResult('')
    try {
      const fd = new FormData()
      fd.append('jd', jd)
      const serialized = serializeForm(formData)
      if (serialized.trim()) fd.append('experience', serialized)
      if (file) fd.append('resume', file)
      await streamSSE('/api/resume/optimize', fd,
        (t) => setResult(prev => prev + t),
        () => setPhase('done'),
        (p) => setPhase(p),
      )
    } catch (err) { setPhase('error'); setError(String(err)) }
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📄 {t('tools.resume-optimize.label')}</CardTitle>
          <CardDescription>{t('optimize.cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <ModeBtn active={mode === 'upload'} onClick={() => setMode('upload')}><span className="flex items-center justify-center gap-1.5"><Upload className="h-3.5 w-3.5" />{t('optimize.modeUpload')}</span></ModeBtn>
            <ModeBtn active={mode === 'form'} onClick={() => setMode('form')}><span className="flex items-center justify-center gap-1.5"><Pencil className="h-3.5 w-3.5" />{t('optimize.modeForm')}</span></ModeBtn>
            <ModeBtn active={mode === 'both'} onClick={() => setMode('both')}><span className="flex items-center justify-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />{t('optimize.modeBoth')}</span></ModeBtn>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t('optimize.jdLabel')}</label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={4} disabled={isLoading}
              placeholder={t('optimize.jdPlaceholder')} className="resize-none text-sm" />
          </div>
          {(mode === 'upload' || mode === 'both') && <FileUploadZone file={file} onFile={setFile} disabled={isLoading} />}
          {(mode === 'form' || mode === 'both') && <StructuredForm data={formData} onChange={setFormData} disabled={isLoading} />}
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={(!jd.trim() && !hasContent()) || isLoading} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('optimize.processing')}</> : <><Sparkles className="h-4 w-4" />{t('tools.resume-optimize.submit')}</>}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <PhaseIndicator phase={phase} />
        <ResultPanel result={result} loading={isLoading}
          emptyIcon={<div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Brain className="h-5 w-5 text-blue-500" /></div><div className="text-gray-300 text-lg">→</div><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}><Pencil className="h-5 w-5" style={{ color: 'var(--primary)' }} /></div></div>}
          emptyTitle={t('optimize.emptyTitle')} emptyDesc={<>{t('optimize.emptyDesc1')}<br />{t('optimize.emptyDesc2')}</>} />
      </div>
    </div>
  )
}

// ─── Cover Letter (custom) ────────────────────────────────────────
function CoverLetterView() {
  const t = useTranslations('Resume')
  const [jd, setJd]                 = useState('')
  const [experience, setExperience] = useState('')
  const [selectedTemplate, setTpl]  = useState('')
  const [customInstructions, setCI] = useState('')
  const [templates, setTemplates]   = useState<Template[]>([])
  const [templatesLoading, setTplLoading] = useState(true)
  const [phase, setPhase]           = useState<Phase>('idle')
  const [result, setResult]         = useState('')
  const [error, setError]           = useState('')
  useEffect(() => {
    fetch('/api/resume/templates').then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setTplLoading(false) })
      .catch(() => setTplLoading(false))
  }, [])
  const isLoading = phase === 'writing'
  const handleSubmit = async () => {
    if (!jd.trim() && !experience.trim()) return
    setPhase('writing'); setError(''); setResult('')
    try {
      await streamSSE('/api/resume/cover-letter',
        { jd, experience, templateId: selectedTemplate, customInstructions },
        (t) => setResult(p => p + t),
        () => setPhase('done'),
      )
    } catch (err) { setPhase('error'); setError(String(err)) }
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">✉️ {t('tools.cover-letter.label')}</CardTitle>
          <CardDescription>{t('cover.cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('cover.selectTemplate')}</label>
            {templatesLoading
              ? <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('cover.loadingTemplates')}</div>
              : <div className="grid grid-cols-1 gap-2">
                  <button type="button" onClick={() => setTpl('')}
                    className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                    style={!selectedTemplate ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                    <div className="text-sm font-medium">{t('cover.freeform')}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t('cover.freeformDesc')}</div>
                  </button>
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => setTpl(t.id)}
                      className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                      style={selectedTemplate === t.id ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}>{t.category}</span>
                      </div>
                      {t.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</div>}
                    </button>
                  ))}
                </div>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t('cover.jdLabel')} <span className="text-red-500">*</span></label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={5} disabled={isLoading} placeholder={t('cover.jdPlaceholder')} className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">{t('cover.expLabel')} <span className="text-red-500">*</span></label>
            <Textarea value={experience} onChange={e => setExperience(e.target.value)} rows={5} disabled={isLoading} placeholder={t('cover.expPlaceholder')} className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-500">{t('cover.extraLabel')}</label>
            <Textarea value={customInstructions} onChange={e => setCI(e.target.value)} rows={2} disabled={isLoading} placeholder={t('cover.extraPlaceholder')} className="resize-none text-sm" />
          </div>
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={(!jd.trim() && !experience.trim()) || isLoading} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('generating')}</> : <><Mail className="h-4 w-4" />{t('tools.cover-letter.submit')}</>}
          </Button>
        </CardContent>
      </Card>
      <ResultPanel result={result} loading={isLoading}
        emptyIcon={<div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}><Mail className="h-6 w-6" style={{ color: 'var(--primary)' }} /></div>}
        emptyTitle={t('cover.emptyTitle')} emptyDesc={<>{t('cover.emptyDesc1')}<br />{t('cover.emptyDesc2')}</>} />
    </div>
  )
}

// ─── Tool Card ────────────────────────────────────────────────────
function ToolCard({ tool, onClick }: { tool: ToolConfig; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group text-left p-4 rounded-2xl border bg-white hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${tool.color} text-white text-lg shrink-0`}>
        {tool.emoji}
      </div>
      <p className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">{tool.label}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tool.desc}</p>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function WorkerToolsPage() {
  const t = useTranslations('Resume')
  const TOOL_CONFIGS = TOOL_DEFS.map(d => buildTool(d, t))
  const CATEGORIES = CATEGORY_DEFS.map(c => ({ id: c.id, label: t(`categories.${c.id}.label`), desc: t(`categories.${c.id}.desc`) }))
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORY_DEFS[number]['id']>('job-search')
  const [userType, setUserType] = useState<string | null>(null)

  // 員工帳號隱藏「求職階段」（公司內部員工不需求職功能）
  const isEmployee = userType === 'employee'
  const visibleCategories = CATEGORIES.filter(c => !(isEmployee && c.id === 'job-search'))

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserType(d.user_type ?? null)).catch(() => {})
  }, [])

  // 員工預設停在第一個可見分類，且避免選到被隱藏的求職工具
  useEffect(() => {
    if (isEmployee && activeCategory === 'job-search') setActiveCategory('workplace')
  }, [isEmployee, activeCategory])

  const tool = TOOL_CONFIGS.find(t => t.id === selectedTool)

  const renderToolView = () => {
    if (!tool) return null
    if (tool.id === 'resume-optimize') return <ResumeOptimizeView />
    if (tool.id === 'cover-letter')    return <CoverLetterView />
    return <GenericToolView tool={tool} />
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        {selectedTool && (
          <button type="button" onClick={() => setSelectedTool(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-4 w-4" />{t('back')}
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            {t('pageTitle')}
          </h1>
          {!selectedTool && <p className="text-gray-500 text-sm mt-1">{t('pageSubtitle')}</p>}
          {selectedTool && tool && <p className="text-gray-500 text-sm mt-1">{tool.emoji} {tool.label}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/hr">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Building2 className="h-4 w-4" />人事管理
            </Button>
          </Link>
          <Link href="/finance">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Wallet className="h-4 w-4" />出納總務
            </Button>
          </Link>
          <Link href="/work">
            <Button variant="outline" size="sm" className="gap-1.5">
              <NotebookPen className="h-4 w-4" />{t('workArea')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Tool View */}
      {selectedTool ? (
        renderToolView()
      ) : (
        <>
          {/* Category Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
            {visibleCategories.map(cat => (
              <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={activeCategory === cat.id
                  ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#6b7280' }}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tool Grid */}
          {CATEGORIES.filter(c => c.id === activeCategory).map(cat => (
            <div key={cat.id}>
              <p className="text-xs text-gray-400 mb-4">{cat.desc}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {TOOL_CONFIGS.filter(t => t.category === cat.id).map(t => (
                  <ToolCard key={t.id} tool={t} onClick={() => setSelectedTool(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
