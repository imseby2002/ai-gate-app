'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import {
  Loader2, Sparkles, FileText, Upload, X, ClipboardCopy, Check,
  Brain, Pencil, Mail, FileCheck, ChevronDown, ChevronUp, Plus, Trash2,
  User, GraduationCap, Briefcase, Wrench, Star, ArrowLeft,
  MessageSquare, DollarSign, BarChart2, Presentation, ClipboardList,
  MessageCircle, TrendingUp, Zap,
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
  category: 'job-search' | 'workplace' | 'advanced'
  label: string
  emoji: string
  desc: string
  color: string
  fields: ToolField[]
  submitLabel: string
  custom?: boolean  // uses dedicated component
}

// ─── Tool Configs ────────────────────────────────────────────────
const TOOL_CONFIGS: ToolConfig[] = [
  // 求職階段
  {
    id: 'resume-optimize', category: 'job-search', label: '履歷優化', emoji: '📄',
    desc: '貼入 JD，AI 雙模型分析並重寫 ATS 優化履歷',
    color: 'from-blue-500 to-indigo-600', fields: [], submitLabel: '開始優化', custom: true,
  },
  {
    id: 'cover-letter', category: 'job-search', label: '求職信撰寫', emoji: '✉️',
    desc: '選模板、輸入 JD 與經歷，Claude 生成完整求職信',
    color: 'from-blue-400 to-cyan-500', fields: [], submitLabel: '生成求職信', custom: true,
  },
  {
    id: 'interview-practice', category: 'job-search', label: '面試問題練習', emoji: '🎯',
    desc: '模擬面試常見問題 + STAR 框架建議回答',
    color: 'from-violet-500 to-purple-600',
    fields: [
      { key: 'jd', label: '目標職缺 JD', type: 'textarea', placeholder: '貼入職缺描述，AI 更精準…', required: true },
      { key: 'background', label: '個人背景簡述', type: 'textarea', placeholder: '簡述你的學歷、工作年資、主要技能…' },
    ],
    submitLabel: '生成面試題',
  },
  {
    id: 'salary-negotiation', category: 'job-search', label: '薪資談判話術', emoji: '💰',
    desc: '提供完整談判劇本，幫你爭取應得的薪資',
    color: 'from-green-500 to-emerald-600',
    fields: [
      { key: 'position', label: '目標職位與產業', type: 'input', placeholder: '例如：行銷企劃／科技業', required: true },
      { key: 'currentSalary', label: '目前薪資（月薪）', type: 'input', placeholder: '例如：35,000' },
      { key: 'targetSalary', label: '期望薪資（月薪）', type: 'input', placeholder: '例如：45,000', required: true },
      { key: 'highlights', label: '個人亮點與成就', type: 'textarea', placeholder: '你的競爭力、過去成果、特殊技能…' },
    ],
    submitLabel: '生成談判話術',
  },

  // 職場日常
  {
    id: 'email-draft', category: 'workplace', label: 'Email 草稿', emoji: '📧',
    desc: '道歉信、催款、跨部門溝通，一鍵生成得體 Email',
    color: 'from-orange-400 to-amber-500',
    fields: [
      { key: 'type', label: 'Email 類型', type: 'select', required: true,
        options: ['道歉信', '催款/追款', '跨部門請求協助', '拒絕請求', '匯報進度', '感謝信', '其他'] },
      { key: 'relationship', label: '收件人與關係', type: 'input', placeholder: '例如：主管（直屬）、客戶、跨部門同事…' },
      { key: 'context', label: '情境說明', type: 'textarea', placeholder: '描述事情背景與你想達到的目的…', required: true },
      { key: 'keyPoints', label: '需強調的重點（選填）', type: 'textarea', placeholder: '例如：強調誠意、保持專業但不卑微…' },
    ],
    submitLabel: '生成 Email',
  },
  {
    id: 'report-writing', category: 'workplace', label: '報告／提案撰寫', emoji: '📊',
    desc: '輸入主題與重點，AI 生成完整報告結構與內容',
    color: 'from-teal-500 to-cyan-600',
    fields: [
      { key: 'topic', label: '報告主題', type: 'input', placeholder: '例如：Q3 銷售成果分析', required: true },
      { key: 'context', label: '背景情境', type: 'textarea', placeholder: '說明報告的目的與背景…' },
      { key: 'mainPoints', label: '主要論點／數據', type: 'textarea', placeholder: '列出你有的數據、結論或論點…', required: true },
      { key: 'audience', label: '目標受眾', type: 'input', placeholder: '例如：高階主管、客戶、全體員工…' },
    ],
    submitLabel: '生成報告',
  },
  {
    id: 'presentation-outline', category: 'workplace', label: '簡報大綱生成', emoji: '🖥️',
    desc: '主題 + 受眾 → AI 生成每頁大綱與視覺化建議',
    color: 'from-pink-500 to-rose-600',
    fields: [
      { key: 'topic', label: '簡報主題', type: 'input', placeholder: '例如：2025 年品牌策略規劃', required: true },
      { key: 'audience', label: '目標受眾', type: 'input', placeholder: '例如：董事會、潛在客戶…' },
      { key: 'coreMessage', label: '核心訊息（聽眾應記住的）', type: 'textarea', placeholder: '用一句話說出你最想傳達的訊息…', required: true },
      { key: 'duration', label: '簡報時長', type: 'input', placeholder: '例如：10 分鐘、30 分鐘' },
    ],
    submitLabel: '生成簡報大綱',
  },
  {
    id: 'meeting-minutes', category: 'workplace', label: '會議記錄整理', emoji: '📝',
    desc: '貼入雜亂的會議記錄，自動整理成結構化文件',
    color: 'from-slate-500 to-gray-600',
    fields: [
      { key: 'rawNotes', label: '原始會議記錄', type: 'textarea', placeholder: '貼入你的會議記錄文字（可以很雜亂）…', required: true },
    ],
    submitLabel: '整理會議記錄',
  },

  // 進階場景
  {
    id: 'workplace-phrases', category: 'advanced', label: '職場話術', emoji: '🗣️',
    desc: '被刁難主管、拒絕額外工作…提供多套應對話術',
    color: 'from-red-500 to-orange-600',
    fields: [
      { key: 'scenario', label: '場景類型', type: 'select', required: true,
        options: ['被主管刁難', '拒絕額外工作', '向上管理', '應對搶功同事', '提出反對意見', '談論加薪', '其他'] },
      { key: 'context', label: '具體情境描述', type: 'textarea', placeholder: '說明具體發生了什麼事…', required: true },
      { key: 'goal', label: '期望達到的結果', type: 'textarea', placeholder: '你希望這次溝通達成什麼目標…' },
    ],
    submitLabel: '生成話術建議',
  },
  {
    id: 'performance-review', category: 'advanced', label: '績效自評撰寫', emoji: '⭐',
    desc: '輸入工作內容與成果，AI 幫你寫出有說服力的自評',
    color: 'from-yellow-500 to-amber-600',
    fields: [
      { key: 'position', label: '職位與部門', type: 'input', placeholder: '例如：行銷部 數位行銷專員', required: true },
      { key: 'workContent', label: '本期主要工作內容', type: 'textarea', placeholder: '列出你這期負責的主要工作項目…', required: true },
      { key: 'achievements', label: '重要成果（盡量含數字）', type: 'textarea', placeholder: '例如：完成 XX 項目，成長 XX%…' },
      { key: 'challenges', label: '克服的挑戰（選填）', type: 'textarea', placeholder: '說明你遇到的困難與如何解決…' },
    ],
    submitLabel: '生成績效自評',
  },
  {
    id: 'promotion-letter', category: 'advanced', label: '升職申請信', emoji: '🚀',
    desc: '撰寫有力的升職申請信，突出你的貢獻與價值',
    color: 'from-purple-500 to-violet-600',
    fields: [
      { key: 'positions', label: '目前職位 → 申請職位', type: 'input', placeholder: '例如：業務專員 → 業務主任', required: true },
      { key: 'background', label: '個人背景與年資', type: 'input', placeholder: '例如：在職 3 年，理工背景…' },
      { key: 'achievements', label: '重要貢獻與成就', type: 'textarea', placeholder: '列出你對公司的具體貢獻（含數字更好）…', required: true },
      { key: 'reason', label: '申請理由', type: 'textarea', placeholder: '為什麼你是這個職位的最佳人選…' },
    ],
    submitLabel: '生成升職申請信',
  },
  {
    id: 'quantify-work', category: 'advanced', label: '工作內容量化', emoji: '📈',
    desc: '把「我負責 XXX」變成有數字、有影響力的亮點句',
    color: 'from-indigo-500 to-blue-600',
    fields: [
      { key: 'jobContent', label: '工作描述（每行一條）', type: 'textarea', placeholder: '例如：\n負責社群媒體管理\n協助舉辦年度活動\n處理客戶投訴', required: true },
    ],
    submitLabel: '量化我的工作',
  },
]

const CATEGORIES = [
  { id: 'job-search', label: '🔍 求職階段', desc: '履歷、求職信、面試、薪資談判' },
  { id: 'workplace', label: '💼 職場日常', desc: 'Email、報告、簡報、會議記錄' },
  { id: 'advanced', label: '🧠 進階場景', desc: '話術、績效、升職、工作量化' },
] as const

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
        <option value="">請選擇…</option>
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
                <Loader2 className="h-3 w-3 animate-spin" />生成中…
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
              ? <><Loader2 className="h-4 w-4 animate-spin" />AI 生成中…</>
              : <><Sparkles className="h-4 w-4" />{tool.submitLabel}</>}
          </Button>
        </CardContent>
      </Card>
      <ResultPanel result={result} loading={isLoading}
        emptyIcon={<div className="text-4xl">{tool.emoji}</div>}
        emptyTitle={`等待生成 ${tool.label}`}
        emptyDesc={<>填寫左側資料，點擊「{tool.submitLabel}」<br />AI 將立即為你生成</>} />
    </div>
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
                <p className="text-sm text-gray-600 font-medium">點擊上傳或拖曳履歷至此</p>
                <p className="text-xs text-gray-400 mt-0.5">支援 JPG · PDF · Word（最大 10 MB）</p>
              </div>
            </>}
      </div>
      {file && file.type.startsWith('image/') && <p className="text-xs text-blue-600">✓ JPG 圖片將由 Claude 視覺辨識分析</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Structured Form ──────────────────────────────────────────────
function StructuredForm({ data, onChange, disabled }: {
  data: ResumeForm; onChange: (d: ResumeForm) => void; disabled?: boolean
}) {
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
      <SectionBlock icon={<User className="h-4 w-4" style={{ color: 'var(--primary)' }} />} title="一、基本資料" open={open.basic} onToggle={() => toggle('basic')}>
        <div className="grid grid-cols-2 gap-2">
          <InputEl value={data.name} onChange={v => set('name', v)} placeholder="姓名" disabled={disabled} />
          <InputEl value={data.phone} onChange={v => set('phone', v)} placeholder="聯絡電話" disabled={disabled} />
          <InputEl value={data.email} onChange={v => set('email', v)} placeholder="電子郵件" disabled={disabled} className="col-span-2" />
          <InputEl value={data.targetPosition} onChange={v => set('targetPosition', v)} placeholder="應徵職位" disabled={disabled} className="col-span-2" />
        </div>
      </SectionBlock>
      <SectionBlock icon={<GraduationCap className="h-4 w-4 text-blue-500" />} title="二、學歷與證照" open={open.edu} onToggle={() => toggle('edu')}>
        {data.education.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">學歷 {i + 1}</span>
              {i > 0 && <button type="button" onClick={() => set('education', data.education.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <InputEl value={e.school} onChange={v => setEdu(i, 'school', v)} placeholder="學校名稱" disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <InputEl value={e.major} onChange={v => setEdu(i, 'major', v)} placeholder="科系" disabled={disabled} />
              <InputEl value={e.degree} onChange={v => setEdu(i, 'degree', v)} placeholder="學士／碩士" disabled={disabled} />
            </div>
            <InputEl value={e.period} onChange={v => setEdu(i, 'period', v)} placeholder="就讀期間" disabled={disabled} />
          </div>
        ))}
        {data.education.length < 3 && (
          <button type="button" disabled={disabled} onClick={() => set('education', [...data.education, { ...BLANK_EDU }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />新增學歷
          </button>
        )}
        <Textarea value={data.certifications} onChange={e => set('certifications', e.target.value)} rows={2} disabled={disabled}
          placeholder="相關證照、語言考試…" className="resize-none text-sm" />
      </SectionBlock>
      <SectionBlock icon={<Briefcase className="h-4 w-4 text-orange-500" />} title="三、工作／實習經驗" open={open.exp} onToggle={() => toggle('exp')}>
        {data.experience.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">經歷 {i + 1}</span>
              {i > 0 && <button type="button" onClick={() => set('experience', data.experience.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <InputEl value={e.company} onChange={v => setExp(i, 'company', v)} placeholder="公司名稱" disabled={disabled} />
            <div className="grid grid-cols-2 gap-2">
              <InputEl value={e.title} onChange={v => setExp(i, 'title', v)} placeholder="職稱" disabled={disabled} />
              <InputEl value={e.period} onChange={v => setExp(i, 'period', v)} placeholder="期間" disabled={disabled} />
            </div>
            <Textarea value={e.description} onChange={ev => setExp(i, 'description', ev.target.value)} rows={3} disabled={disabled}
              placeholder="重點成果（建議量化）" className="resize-none text-sm" />
          </div>
        ))}
        {data.experience.length < 5 && (
          <button type="button" disabled={disabled} onClick={() => set('experience', [...data.experience, { ...BLANK_EXP }])}
            className="w-full py-2 rounded-xl border-2 border-dashed text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
            <Plus className="h-3.5 w-3.5" />新增經歷
          </button>
        )}
      </SectionBlock>
      <SectionBlock icon={<Wrench className="h-4 w-4 text-green-500" />} title="四、技能與語言" open={open.skills} onToggle={() => toggle('skills')}>
        <Textarea value={data.skills} onChange={e => set('skills', e.target.value)} rows={3} disabled={disabled}
          placeholder="專業技能：Python、Excel、Figma…" className="resize-none text-sm" />
        <Textarea value={data.languages} onChange={e => set('languages', e.target.value)} rows={2} disabled={disabled}
          placeholder="語言能力：中文（母語）、英文（多益 880）…" className="resize-none text-sm" />
      </SectionBlock>
      <SectionBlock icon={<Star className="h-4 w-4 text-yellow-500" />} title="五、其他（選填）" open={open.other} onToggle={() => toggle('other')}>
        <Textarea value={data.selfIntro} onChange={e => set('selfIntro', e.target.value)} rows={4} disabled={disabled}
          placeholder="自我介紹（3–5 行）" className="resize-none text-sm" />
        <Textarea value={data.other} onChange={e => set('other', e.target.value)} rows={2} disabled={disabled}
          placeholder="其他加分項目" className="resize-none text-sm" />
      </SectionBlock>
    </div>
  )
}

// ─── Phase Indicator ──────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: Phase }) {
  if (phase === 'idle') return null
  const steps = [
    { key: 'analyzing' as Phase, icon: Brain,  label: 'DeepSeek-R1 分析' },
    { key: 'writing'   as Phase, icon: Pencil, label: 'Claude 撰寫' },
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
          <CardTitle className="text-base">📄 履歷優化</CardTitle>
          <CardDescription>選擇填寫方式，越詳細結果越精準</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <ModeBtn active={mode === 'upload'} onClick={() => setMode('upload')}><span className="flex items-center justify-center gap-1.5"><Upload className="h-3.5 w-3.5" />上傳檔案</span></ModeBtn>
            <ModeBtn active={mode === 'form'} onClick={() => setMode('form')}><span className="flex items-center justify-center gap-1.5"><Pencil className="h-3.5 w-3.5" />手動填寫</span></ModeBtn>
            <ModeBtn active={mode === 'both'} onClick={() => setMode('both')}><span className="flex items-center justify-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />兩者皆有</span></ModeBtn>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">目標職缺 JD</label>
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={4} disabled={isLoading}
              placeholder="貼上職缺描述（Job Description）…" className="resize-none text-sm" />
          </div>
          {(mode === 'upload' || mode === 'both') && <FileUploadZone file={file} onFile={setFile} disabled={isLoading} />}
          {(mode === 'form' || mode === 'both') && <StructuredForm data={formData} onChange={setFormData} disabled={isLoading} />}
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={(!jd.trim() && !hasContent()) || isLoading} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />處理中…</> : <><Sparkles className="h-4 w-4" />開始優化</>}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <PhaseIndicator phase={phase} />
        <ResultPanel result={result} loading={isLoading}
          emptyIcon={<div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Brain className="h-5 w-5 text-blue-500" /></div><div className="text-gray-300 text-lg">→</div><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}><Pencil className="h-5 w-5" style={{ color: 'var(--primary)' }} /></div></div>}
          emptyTitle="雙模型協作" emptyDesc={<>DeepSeek-R1 分析落差<br />Claude Sonnet 撰寫優化履歷</>} />
      </div>
    </div>
  )
}

// ─── Cover Letter (custom) ────────────────────────────────────────
function CoverLetterView() {
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
          <CardTitle className="text-base">✉️ 求職信撰寫</CardTitle>
          <CardDescription>選擇模板並填寫 JD 與經歷</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
            <Textarea value={jd} onChange={e => setJd(e.target.value)} rows={5} disabled={isLoading} placeholder="貼上職缺描述…" className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">過往經歷 <span className="text-red-500">*</span></label>
            <Textarea value={experience} onChange={e => setExperience(e.target.value)} rows={5} disabled={isLoading} placeholder="描述您的工作經歷、技能與成就…" className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-500">額外要求（選填）</label>
            <Textarea value={customInstructions} onChange={e => setCI(e.target.value)} rows={2} disabled={isLoading} placeholder="例如：請用英文撰寫、語氣偏輕鬆…" className="resize-none text-sm" />
          </div>
          {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
          <Button onClick={handleSubmit} disabled={(!jd.trim() && !experience.trim()) || isLoading} className="w-full py-5 text-sm font-semibold rounded-xl" size="lg">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />生成中…</> : <><Mail className="h-4 w-4" />生成求職信</>}
          </Button>
        </CardContent>
      </Card>
      <ResultPanel result={result} loading={isLoading}
        emptyIcon={<div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}><Mail className="h-6 w-6" style={{ color: 'var(--primary)' }} /></div>}
        emptyTitle="尚無求職信" emptyDesc={<>選擇模板並填寫 JD 與經歷<br />Claude 將為你撰寫求職信</>} />
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
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['id']>('job-search')

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
            <ArrowLeft className="h-4 w-4" />返回
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            打工人專用
          </h1>
          {!selectedTool && <p className="text-gray-500 text-sm mt-1">AI 全方位職場助理 — 求職 × 日常 × 進階場景</p>}
          {selectedTool && tool && <p className="text-gray-500 text-sm mt-1">{tool.emoji} {tool.label}</p>}
        </div>
      </div>

      {/* Tool View */}
      {selectedTool ? (
        renderToolView()
      ) : (
        <>
          {/* Category Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
            {CATEGORIES.map(cat => (
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
