'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import {
  Loader2, Sparkles, FileText, Upload, X, ClipboardCopy, Check,
  Brain, Pencil, Mail, FileCheck, ChevronDown, ChevronUp, Plus, Trash2,
  User, GraduationCap, Briefcase, Wrench, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

// ─── Types ───────────────────────────────────────────────────────
type Phase      = 'idle' | 'analyzing' | 'writing' | 'done' | 'error'
type Tab        = 'resume' | 'cover-letter'
type InputMode  = 'upload' | 'form' | 'both'

interface EduEntry  { school: string; major: string; degree: string; period: string }
interface ExpEntry  { company: string; title: string; period: string; description: string }
interface ResumeForm {
  // 基本資料
  name: string; phone: string; email: string
  birthdate: string; gender: string; targetPosition: string
  // 學歷
  education: EduEntry[]; certifications: string
  // 經歷
  experience: ExpEntry[]
  // 技能
  skills: string; languages: string
  // 其他
  portfolio: string; selfIntro: string; other: string
}
interface Template { id: string; name: string; description: string; category: string }

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
  onPhase: (p: Phase, label?: string) => void,
  onDelta: (t: string) => void,
  onDone: () => void,
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
        if (ev.type === 'phase' && ev.phase)        onPhase(ev.phase, ev.label)
        else if (ev.type === 'delta' && ev.content) onDelta(ev.content)
        else if (ev.type === 'done')                 onDone()
        else if (ev.type === 'error')                throw new Error(ev.error)
      } catch (e) { if (e instanceof Error && e.message !== 'JSON') throw e }
    }
  }
}

// ─── Small UI ────────────────────────────────────────────────────
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
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, disabled, type = 'text', className = '' }:
  { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string; className?: string }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:bg-gray-50 ${className}`}
      style={{ '--tw-ring-color': 'color-mix(in oklch, var(--primary) 30%, transparent)' } as React.CSSProperties}
    />
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

// ─── File Upload Zone ─────────────────────────────────────────────
function FileUploadZone({ file, onFile, disabled }: { file: File | null; onFile: (f: File | null) => void; disabled?: boolean }) {
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sel = e.target.files?.[0]; setError('')
    if (!sel) return
    if (!ACCEPTED_TYPES.includes(sel.type)) { setError('僅支援 JPG、PDF、Word'); e.target.value = ''; return }
    if (sel.size > 10 * 1024 * 1024) { setError('檔案大小不可超過 10 MB'); e.target.value = ''; return }
    onFile(sel)
  }
  const remove = () => { onFile(null); if (ref.current) ref.current.value = '' }

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors"
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
                <p className="text-sm text-gray-600 font-medium">點擊上傳或拖曳履歷至此</p>
                <p className="text-xs text-gray-400 mt-0.5">支援 JPG · PDF · Word（最大 10 MB）</p>
              </div>
            </>}
      </div>
      {file && file.type.startsWith('image/') && <p className="text-xs text-blue-600">✓ JPG 圖片將由 Claude 視覺辨識分析</p>}
      {file && !file.type.startsWith('image/') && <p className="text-xs text-gray-400">PDF / Word 作為參考附件</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Structured Form ──────────────────────────────────────────────
function StructuredForm({ data, onChange, disabled }: {
  data: ResumeForm; onChange: (d: ResumeForm) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    basic: true, edu: false, exp: false, skills: false, other: false,
  })
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
      {/* 一、基本資料 */}
      <SectionBlock icon={<User className="h-4 w-4" style={{ color: 'var(--primary)' }} />} title="一、基本資料" open={open.basic} onToggle={() => toggle('basic')}>
        <div className="grid grid-cols-2 gap-2">
          <Input value={data.name} onChange={v => set('name', v)} placeholder="姓名" disabled={disabled} />
          <Input value={data.phone} onChange={v => set('phone', v)} placeholder="聯絡電話" disabled={disabled} />
          <Input value={data.email} onChange={v => set('email', v)} placeholder="電子郵件" disabled={disabled} className="col-span-2" />
          <Input value={data.targetPosition} onChange={v => set('targetPosition', v)} placeholder="應徵職位，例如：門市管理／行銷企劃" disabled={disabled} className="col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={data.birthdate} onChange={v => set('birthdate', v)} placeholder="出生年月日（選填）" disabled={disabled} />
          <Input value={data.gender} onChange={v => set('gender', v)} placeholder="性別（選填）" disabled={disabled} />
        </div>
      </SectionBlock>

      {/* 二、學歷與證照 */}
      <SectionBlock icon={<GraduationCap className="h-4 w-4 text-blue-500" />} title="二、學歷與證照" open={open.edu} onToggle={() => toggle('edu')}>
        {data.education.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">學歷 {i + 1}</span>
              {i > 0 && (
                <button type="button" onClick={() => set('education', data.education.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <Input value={e.school} onChange={v => setEdu(i, 'school', v)} placeholder="學校名稱" disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={e.major} onChange={v => setEdu(i, 'major', v)} placeholder="科系／學位" disabled={disabled} />
              <Input value={e.degree} onChange={v => setEdu(i, 'degree', v)} placeholder="學位（學士／碩士）" disabled={disabled} />
            </div>
            <Input value={e.period} onChange={v => setEdu(i, 'period', v)} placeholder="就讀期間，例如：2020–2024" disabled={disabled} />
          </div>
        ))}
        {data.education.length < 3 && (
          <button type="button" disabled={disabled}
            onClick={() => set('education', [...data.education, { ...BLANK_EDU }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />新增學歷
          </button>
        )}
        <Textarea value={data.certifications} onChange={e => set('certifications', e.target.value)} rows={3} disabled={disabled}
          placeholder="相關證照、語言考試、課程&#10;例如：多益 850、Google Analytics、PMP…" className="resize-none text-sm" />
      </SectionBlock>

      {/* 三、工作／實習／專案經驗 */}
      <SectionBlock icon={<Briefcase className="h-4 w-4 text-orange-500" />} title="三、工作／實習／專案經驗" open={open.exp} onToggle={() => toggle('exp')}>
        {data.experience.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">經歷 {i + 1}</span>
              {i > 0 && (
                <button type="button" onClick={() => set('experience', data.experience.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <Input value={e.company} onChange={v => setExp(i, 'company', v)} placeholder="公司／組織／專案名稱" disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <Input value={e.title} onChange={v => setExp(i, 'title', v)} placeholder="職稱／身份" disabled={disabled} />
              <Input value={e.period} onChange={v => setExp(i, 'period', v)} placeholder="期間，例如：2022–2024" disabled={disabled} />
            </div>
            <Textarea value={e.description} onChange={ev => setExp(i, 'description', ev.target.value)} rows={3} disabled={disabled}
              placeholder="重點成果（建議量化）&#10;例如：負責門市排班與庫存管理，3 個月提升營收 15%" className="resize-none text-sm" />
          </div>
        ))}
        {data.experience.length < 5 && (
          <button type="button" disabled={disabled}
            onClick={() => set('experience', [...data.experience, { ...BLANK_EXP }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />新增經歷
          </button>
        )}
      </SectionBlock>

      {/* 四、技能與語言 */}
      <SectionBlock icon={<Wrench className="h-4 w-4 text-green-500" />} title="四、技能與語言能力" open={open.skills} onToggle={() => toggle('skills')}>
        <Textarea value={data.skills} onChange={e => set('skills', e.target.value)} rows={3} disabled={disabled}
          placeholder="專業技能，例如：Python、Excel、Figma、SEO、Google Ads…&#10;（與職缺越相關越好）" className="resize-none text-sm" />
        <Textarea value={data.languages} onChange={e => set('languages', e.target.value)} rows={2} disabled={disabled}
          placeholder="語言能力，例如：中文（母語）、英文（多益 880）、越語（流利）" className="resize-none text-sm" />
      </SectionBlock>

      {/* 五、其他加分內容 */}
      <SectionBlock icon={<Star className="h-4 w-4 text-yellow-500" />} title="五、其他加分內容（選填）" open={open.other} onToggle={() => toggle('other')}>
        <Textarea value={data.portfolio} onChange={e => set('portfolio', e.target.value)} rows={2} disabled={disabled}
          placeholder="作品集／專案成就／得獎紀錄…" className="resize-none text-sm" />
        <Textarea value={data.selfIntro} onChange={e => set('selfIntro', e.target.value)} rows={4} disabled={disabled}
          placeholder="自我介紹（3–5 行）：濃縮你的定位與優勢&#10;例如：3 年數位行銷經驗，擅長數據驅動的內容策略…" className="resize-none text-sm" />
        <Textarea value={data.other} onChange={e => set('other', e.target.value)} rows={2} disabled={disabled}
          placeholder="其他：興趣專長、團隊領導、跨文化溝通…（選填）" className="resize-none text-sm" />
      </SectionBlock>
    </div>
  )
}

// ─── Phase Indicator ──────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: Phase }) {
  if (phase === 'idle') return null
  const steps: Array<{ key: Phase; icon: React.ElementType; label: string; desc: string }> = [
    { key: 'analyzing', icon: Brain,  label: 'DeepSeek-R1 分析', desc: '比對 JD 關鍵字與落差' },
    { key: 'writing',   icon: Pencil, label: 'Claude Sonnet 生成', desc: '撰寫 ATS 優化履歷' },
  ]
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50 mb-3">
      {steps.map((step, i) => {
        const Icon = step.icon
        const isActive = phase === step.key
        const isDone = (step.key === 'analyzing' && (phase === 'writing' || phase === 'done')) ||
                       (step.key === 'writing' && phase === 'done')
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={isActive ? { background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }
                : isDone ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f3f4f6', color: '#9ca3af' }}>
              {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium" style={isActive ? { color: 'var(--primary)' } : isDone ? { color: '#16a34a' } : { color: '#9ca3af' }}>
                {step.label}
              </p>
              <p className="text-xs text-gray-400 hidden sm:block">{step.desc}</p>
            </div>
            {i < steps.length - 1 && <div className="w-5 h-px bg-gray-300 shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Result Panel ─────────────────────────────────────────────────
function ResultPanel({ result, loading, phase, emptyIcon, emptyTitle, emptyDesc, writingLabel }: {
  result: string; loading: boolean; phase: Phase
  emptyIcon: ReactNode; emptyTitle: string; emptyDesc: ReactNode; writingLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <Card className="rounded-2xl shadow-sm lg:sticky lg:top-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">AI 生成結果</CardTitle>
            <CardDescription className="mt-1">優化後的內容將顯示於此</CardDescription>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5 text-xs">
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
          <div>
            <Textarea readOnly value={result} rows={24}
              className="resize-none text-sm leading-relaxed bg-gray-50 cursor-default focus-visible:ring-0 border-gray-200" />
            {loading && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />{writingLabel}
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

// ─── Resume Optimizer Tab ─────────────────────────────────────────
function ResumeTab() {
  const [mode, setMode]       = useState<InputMode>('form')
  const [jd, setJd]           = useState('')
  const [file, setFile]       = useState<File | null>(null)
  const [formData, setFormData] = useState<ResumeForm>({ ...BLANK_FORM })
  const [phase, setPhase]     = useState<Phase>('idle')
  const [result, setResult]   = useState('')
  const [error, setError]     = useState('')

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
      await streamSSE(
        '/api/resume/optimize', fd,
        (p) => setPhase(p),
        (t) => setResult(prev => prev + t),
        ()  => setPhase('done'),
      )
    } catch (err) { setPhase('error'); setError(String(err)) }
  }

  const canSubmit = (jd.trim() || hasContent()) && !isLoading

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Left: Input */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">輸入資料</CardTitle>
          <CardDescription>選擇填寫方式，越詳細結果越精準</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Mode selector */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <ModeBtn active={mode === 'upload'} onClick={() => setMode('upload')}>
              <span className="flex items-center justify-center gap-1.5"><Upload className="h-3.5 w-3.5" />只上傳檔案</span>
            </ModeBtn>
            <ModeBtn active={mode === 'form'} onClick={() => setMode('form')}>
              <span className="flex items-center justify-center gap-1.5"><Pencil className="h-3.5 w-3.5" />手動填寫</span>
            </ModeBtn>
            <ModeBtn active={mode === 'both'} onClick={() => setMode('both')}>
              <span className="flex items-center justify-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />兩者皆有</span>
            </ModeBtn>
          </div>

          {/* JD — always shown */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              目標職缺 JD <span className="text-xs text-gray-400 font-normal ml-1">（貼入職缺描述，AI 更精準）</span>
            </label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={4} disabled={isLoading}
              placeholder={'貼上職缺描述（Job Description）…\n\n例如：\n・負責門市營運與人員管理\n・需具備 Excel 與數據分析能力'}
              className="resize-none text-sm leading-relaxed" />
          </div>

          {/* Upload zone */}
          {(mode === 'upload' || mode === 'both') && (
            <FileUploadZone file={file} onFile={setFile} disabled={isLoading} />
          )}

          {/* Structured form */}
          {(mode === 'form' || mode === 'both') && (
            <StructuredForm data={formData} onChange={setFormData} disabled={isLoading} />
          )}

          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />處理中，請稍候…</>
              : <><Sparkles className="h-4 w-4" />開始優化</>}
          </Button>
        </CardContent>
      </Card>

      {/* Right: Result */}
      <div className="space-y-3">
        <PhaseIndicator phase={phase} />
        <ResultPanel result={result} loading={isLoading} phase={phase} writingLabel="Claude Sonnet 撰寫中…"
          emptyIcon={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Brain className="h-5 w-5 text-blue-500" /></div>
              <div className="text-gray-300 text-lg">→</div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
                <Pencil className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
            </div>}
          emptyTitle="雙模型協作"
          emptyDesc={<>DeepSeek-R1 分析落差<br />Claude Sonnet 撰寫優化履歷</>} />
      </div>
    </div>
  )
}

// ─── Cover Letter Tab ─────────────────────────────────────────────
function CoverLetterTab() {
  const [jd, setJd]                   = useState('')
  const [experience, setExperience]   = useState('')
  const [selectedTemplate, setTpl]    = useState('')
  const [customInstructions, setCI]   = useState('')
  const [templates, setTemplates]     = useState<Template[]>([])
  const [templatesLoading, setTplLoading] = useState(true)
  const [phase, setPhase]             = useState<Phase>('idle')
  const [result, setResult]           = useState('')
  const [error, setError]             = useState('')

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
      await streamSSE(
        '/api/resume/cover-letter',
        { jd, experience, templateId: selectedTemplate, customInstructions },
        () => {},
        (t) => setResult(p => p + t),
        ()  => setPhase('done'),
      )
    } catch (err) { setPhase('error'); setError(String(err)) }
  }

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
            {templatesLoading
              ? <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />載入模板中…</div>
              : <div className="grid grid-cols-1 gap-2">
                  <button type="button" onClick={() => setTpl('')}
                    className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                    style={!selectedTemplate ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' } : {}}>
                    <div className="text-sm font-medium">✨ 自由發揮（不使用模板）</div>
                    <div className="text-xs text-gray-400 mt-0.5">AI 自主決定最適合的求職信結構</div>
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
            <label className="block text-sm font-medium">目標職缺 JD <span className="text-red-500">*</span></label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={5} disabled={isLoading}
              placeholder="貼上職缺描述…" className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">過往經歷 <span className="text-red-500">*</span></label>
            <Textarea value={experience} onChange={e => setExperience(e.target.value)} rows={5} disabled={isLoading}
              placeholder="描述您的工作經歷、技能與成就…" className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">額外要求 <span className="text-xs text-gray-400 font-normal ml-1">（選填）</span></label>
            <Textarea value={customInstructions} onChange={e => setCI(e.target.value)} rows={2} disabled={isLoading}
              placeholder="例如：請用英文撰寫、語氣偏輕鬆、強調領導力…" className="resize-none text-sm" />
          </div>
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={(!jd.trim() && !experience.trim()) || isLoading} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中…</> : <><Mail className="h-4 w-4" />生成求職信</>}
          </Button>
        </CardContent>
      </Card>
      <ResultPanel result={result} loading={isLoading} phase={phase} writingLabel="Claude Sonnet 撰寫中…"
        emptyIcon={<div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}><Mail className="h-6 w-6" style={{ color: 'var(--primary)' }} /></div>}
        emptyTitle="尚無求職信"
        emptyDesc={<>選擇模板並填寫 JD 與經歷<br />Claude Sonnet 將為你撰寫求職信</>} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ResumePage() {
  const [tab, setTab] = useState<Tab>('resume')
  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: 'resume',       label: '精準履歷優化', icon: FileCheck },
    { key: 'cover-letter', label: 'Cover Letter 生成', icon: Mail },
  ]
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6" style={{ color: 'var(--primary)' }} />打工人求職工具箱
        </h1>
        <p className="text-gray-500 text-sm mt-1">AI 驅動的履歷優化 × 求職信生成，全方位提升求職競爭力</p>
      </div>
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
