'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Search, Building2, MapPin, Phone, Play, Loader2,
  CheckCircle2, AlertCircle, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
  Filter, Users, Map, Globe, Mic, Settings2, PhoneCall, GripVertical, Mail,
  Clock, Save, CalendarClock,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CollectSource = 'map' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'amazon' | 'shopee' | 'ios_android' | 'web'

interface ProspectSchedule {
  enabled: boolean
  mode: 'phone' | 'email' | 'both'   // 執行模式
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday: number      // 0=日 1=一…6=六 (weekly用)
  monthDay: number     // 1-31 (monthly用)
  nextRunAt?: string
  lastRunAt?: string
}

const DEFAULT_SCHEDULE: ProspectSchedule = {
  enabled: false,
  mode: 'both',
  frequency: 'daily',
  hour: 8,
  minute: 0,
  weekday: 1,
  monthDay: 1,
}
type StepStatus = 'idle' | 'running' | 'done' | 'error'
type PhoneType = 'any' | 'mobile' | 'landline'

interface Branch {
  id: string; name: string; address: string; phone?: string; lat?: number; lng?: number
}

interface VoiceScript {
  id: string; name: string; text: string; voiceId: string
}

interface RuleCondition {
  phoneType: PhoneType        // any / mobile(行動) / landline(座機)
  aiCategory: string          // '' = 任何
  minEmployees: number        // 0 = 不限
  maxEmployees: number        // 0 = 不限
  maxDistanceKm: number       // 0 = 不限
  customTag: string           // '' = 不限；關鍵字出現在名稱或原始分類即符合
}

interface RoutingRule {
  id: string
  name: string
  condition: RuleCondition
  scriptId: string            // '' = 不撥打
}

interface ProspectOrg {
  id: string; name: string; phone?: string; phoneNormalized?: string
  address?: string; lat?: number; lng?: number
  rawCategory?: string; aiCategory: string; employeeHint?: string
  rating?: number; website?: string; email?: string
  nearestBranch?: string; nearestBranchDistance?: number
  selected: boolean; filterReason?: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface EmailRule {
  id: string
  name: string         // 自訂分類名稱
  desc: string         // AI 分類依據描述
  templateId: string   // 套用哪個模板
  customTag: string    // 關鍵字篩選（名稱或原始分類含此字）
  minEmployees: number
  maxEmployees: number
}

interface Config {
  keywords: string
  location: string
  sources: CollectSource[]
  collectLimit: number        // 蒐集筆數上限
  filterCriteria: string
  minEmployees: number
  distanceEnabled: boolean    // 距離篩選開關
  maxDistanceKm: number
  birdCallerId: string
  voiceScripts: VoiceScript[]
  routingRules: RoutingRule[]
  emailTemplates: EmailTemplate[]
  emailRules: EmailRule[]
  fromName: string
  fromEmail: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

type Translate = ReturnType<typeof useTranslations>

const CATEGORIES = [
  { id: 'factory',    emoji: '🏭' },
  { id: 'hotel',      emoji: '🏨' },
  { id: 'restaurant', emoji: '🍽️' },
  { id: 'financial',  emoji: '🏦' },
  { id: 'retail',     emoji: '🛍️' },
  { id: 'healthcare', emoji: '🏥' },
  { id: 'education',  emoji: '🎓' },
  { id: 'realestate', emoji: '🏠' },
  { id: 'logistics',  emoji: '🚚' },
  { id: 'other',      emoji: '📋' },
]
const catLabel = (t: Translate, id: string) => t.has(`cats.${id}`) ? t(`cats.${id}`) : id

const ELEVEN_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',     descKey: 'voice.mlFemale' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',      descKey: 'voice.mlMale' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', descKey: 'voice.mlFemale' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',    descKey: 'voice.brMale' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',      descKey: 'voice.mlFemale' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',   descKey: 'voice.usFemale' },
]

const EMPTY_CONDITION: RuleCondition = {
  phoneType: 'any',
  aiCategory: '',
  minEmployees: 0,
  maxEmployees: 0,
  maxDistanceKm: 0,
  customTag: '',
}

function makeDefaultConfig(t: Translate): Config {
  return {
    keywords: '',
    location: '',
    sources: ['map'],
    collectLimit: 50,
    filterCriteria: '',
    minEmployees: 0,
    distanceEnabled: false,
    maxDistanceKm: 5,
    birdCallerId: '',
    voiceScripts: [
      { id: 'script-1', name: t('def.script'), text: t('def.scriptText'), voiceId: 'EXAVITQu4vr4xnSDxMaL' },
    ],
    routingRules: [],
    emailTemplates: [
      { id: 'email-1', name: t('def.template'), subject: '', body: '' },
    ],
    emailRules: [
      { id: 'erule-1', name: t('def.generalCustomer'), desc: t('def.generalCustomerDesc'), templateId: 'email-1', customTag: '', minEmployees: 0, maxEmployees: 0 },
    ],
    fromName: t('def.marketingTeam'),
    fromEmail: '',
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse max employee count from hint like "50-100人" → 100 */
function parseMaxEmployees(hint?: string): number | null {
  if (!hint) return null
  const nums = hint.match(/\d+/g)
  if (!nums) return null
  return Math.max(...nums.map(Number))
}

/** Taiwan mobile: +8869xxxxxxxx */
function isMobile(phone?: string): boolean {
  return !!phone?.match(/^\+8869/)
}

// 這些詞視為 catch-all，不做關鍵字篩選（讓規則成為預設/兜底規則）
const CATCHALL_TAGS = ['其他', '其它', 'other', 'all', '全部', '預設', 'default', '其余', '剩余', '剩餘']
function isCatchAll(tag: string): boolean {
  return CATCHALL_TAGS.includes(tag.trim().toLowerCase())
}

function matchRule(org: ProspectOrg, rule: RoutingRule): boolean {
  const c = rule.condition
  // phone type
  if (c.phoneType === 'mobile' && !isMobile(org.phoneNormalized)) return false
  if (c.phoneType === 'landline' && (isMobile(org.phoneNormalized) || !org.phoneNormalized)) return false
  // ai category
  if (c.aiCategory && org.aiCategory !== c.aiCategory) return false
  // employees
  if (c.minEmployees > 0 || c.maxEmployees > 0) {
    const emp = parseMaxEmployees(org.employeeHint)
    if (emp !== null) {
      if (c.minEmployees > 0 && emp < c.minEmployees) return false
      if (c.maxEmployees > 0 && emp > c.maxEmployees) return false
    }
  }
  // distance
  if (c.maxDistanceKm > 0 && org.nearestBranchDistance != null && org.nearestBranchDistance > c.maxDistanceKm) return false
  // custom keyword (search in org name + rawCategory)
  // 若填「其他/other/all/全部/預設」視為 catch-all，不做關鍵字篩選
  if (c.customTag.trim() && !isCatchAll(c.customTag)) {
    const tag = c.customTag.trim().toLowerCase()
    const hay = `${org.name} ${org.rawCategory ?? ''}`.toLowerCase()
    if (!hay.includes(tag)) return false
  }
  return true
}

function conditionSummary(c: RuleCondition, t: Translate): string {
  const parts: string[] = []
  if (c.phoneType === 'mobile') parts.push(t('cond.mobile'))
  if (c.phoneType === 'landline') parts.push(t('cond.landline'))
  if (c.aiCategory) parts.push(catLabel(t, c.aiCategory))
  if (c.minEmployees > 0 && c.maxEmployees > 0) parts.push(t('cond.empRange', { min: c.minEmployees, max: c.maxEmployees }))
  else if (c.minEmployees > 0) parts.push(t('cond.empMin', { min: c.minEmployees }))
  else if (c.maxEmployees > 0) parts.push(t('cond.empMax', { max: c.maxEmployees }))
  if (c.maxDistanceKm > 0) parts.push(`≤${c.maxDistanceKm}km`)
  if (c.customTag.trim()) {
    parts.push(isCatchAll(c.customTag) ? t('cond.catchAll') : t('cond.keyword', { tag: c.customTag.trim() }))
  }
  return parts.length ? parts.join(' · ') : t('cond.all')
}

// ─── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, open, onToggle, children }: {
  title: string; icon: React.ElementType; open: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon className="h-4 w-4 text-gray-500" />{title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

// ─── Step indicator ─────────────────────────────────────────────────────────────

function StepBadge({ status, label }: { status: StepStatus; label: string }) {
  const styles: Record<StepStatus, string> = {
    idle: 'bg-gray-100 text-gray-500',
    running: 'bg-blue-50 text-blue-700',
    done: 'bg-green-50 text-green-700',
    error: 'bg-red-50 text-red-700',
  }
  const icons: Record<StepStatus, React.ReactNode> = {
    idle: <div className="h-3 w-3 rounded-full bg-gray-300" />,
    running: <Loader2 className="h-3 w-3 animate-spin" />,
    done: <CheckCircle2 className="h-3 w-3" />,
    error: <XCircle className="h-3 w-3" />,
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${styles[status]}`}>
      {icons[status]}{label}
    </div>
  )
}

// ─── RoutingRuleEditor ──────────────────────────────────────────────────────────

function RoutingRuleEditor({
  rule,
  voiceScripts,
  onChange,
  onRemove,
  index,
}: {
  rule: RoutingRule
  voiceScripts: VoiceScript[]
  onChange: (patch: Partial<RoutingRule>) => void
  onRemove: () => void
  index: number
}) {
  const t = useTranslations('Prospect')
  const setC = (patch: Partial<RuleCondition>) =>
    onChange({ condition: { ...rule.condition, ...patch } })

  return (
    <div className="rounded-xl border bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b">
        <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
        <span className="text-[10px] font-bold text-gray-400 w-5">{index + 1}</span>
        <input
          value={rule.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={t('rule.namePlaceholder')}
          className="flex-1 h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
        />
        <button type="button" onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Conditions */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {/* Phone type */}
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.phoneType')}</label>
          <div className="flex gap-1">
            {([
              { val: 'any', label: t('rule.any') },
              { val: 'mobile', label: `📱 ${t('cond.mobile')}` },
              { val: 'landline', label: `☎️ ${t('cond.landline')}` },
            ] as { val: PhoneType; label: string }[]).map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setC({ phoneType: opt.val })}
                className={`flex-1 py-1 rounded-md text-[11px] border transition-all ${
                  rule.condition.phoneType === opt.val
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Category */}
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.aiCategory')}</label>
          <select
            value={rule.condition.aiCategory}
            onChange={e => setC({ aiCategory: e.target.value })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          >
            <option value="">{t('rule.anyCategory')}</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {catLabel(t, c.id)}</option>)}
          </select>
        </div>

        {/* Employee range */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.minEmp')}</label>
          <input
            type="number" min={0}
            value={rule.condition.minEmployees}
            onChange={e => setC({ minEmployees: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.maxEmp')}</label>
          <input
            type="number" min={0}
            value={rule.condition.maxEmployees}
            onChange={e => setC({ maxEmployees: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>

        {/* Max distance */}
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.maxDist')}</label>
          <input
            type="number" min={0} step={0.5}
            value={rule.condition.maxDistanceKm}
            onChange={e => setC({ maxDistanceKm: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>

        {/* Custom tag */}
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.customTag')}</label>
          <input
            value={rule.condition.customTag}
            onChange={e => setC({ customTag: e.target.value })}
            placeholder={t('rule.customTagPlaceholder')}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>

        {/* Script */}
        <div className="col-span-2 pt-1 border-t">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">{t('rule.useScript')}</label>
          <select
            value={rule.scriptId}
            onChange={e => onChange({ scriptId: e.target.value })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          >
            <option value="">{t('rule.noCall')}</option>
            {voiceScripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="px-3 pb-2">
        <div className="text-[10px] text-gray-400 bg-white rounded px-2 py-1 border">
          {t('rule.condPrefix')}{conditionSummary(rule.condition, t)}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ProspectCallPage() {
  const t = useTranslations('Prospect')
  const locale = useLocale()
  const [activeTab, setActiveTab] = useState<'phone' | 'email' | 'schedule'>('phone')
  const [config, setConfig] = useState<Config>(() => makeDefaultConfig(t))
  const [branches, setBranches] = useState<Branch[]>([])
  const [openSections, setOpenSections] = useState({ collect: true, filter: true, distance: true, scripts: true, mapping: false, call: true, emailTemplates: true, emailRules: true, emailSettings: true, schedule: false })
  const [schedule, setSchedule] = useState<ProspectSchedule>(DEFAULT_SCHEDULE)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)
  const [scheduleLastResult, setScheduleLastResult] = useState<{ total: number; selected: number; runAt: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [stepStatus, setStepStatus] = useState<Record<string, StepStatus>>({})
  const [stepMsg, setStepMsg] = useState<Record<string, string>>({})
  const [orgs, setOrgs] = useState<ProspectOrg[]>([])
  const [callResults, setCallResults] = useState<Record<string, { ok: number; fail: number }>>({})
  const [callingRule, setCallingRule] = useState<string | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef(false)
  // Email-specific state
  const [orgEmails, setOrgEmails] = useState<Record<string, string>>({})  // orgId → email
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)  // templateId being sent
  const [emailResults, setEmailResults] = useState<Record<string, { ok: number; fail: number }>>({})

  const setC = <K extends keyof Config>(key: K, val: Config[K]) =>
    setConfig(prev => ({ ...prev, [key]: val }))

  // Load branches from company_data
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => { if (d.data?.branches) setBranches(d.data.branches) })
      .catch(() => { })
  }, [])

  // Load schedule from server
  useEffect(() => {
    fetch('/api/marketing/prospect-schedule')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          if (d.data.schedule && Object.keys(d.data.schedule).length > 0)
            setSchedule({ ...DEFAULT_SCHEDULE, ...d.data.schedule })
          if (d.data.config && Object.keys(d.data.config).length > 0)
            setConfig(prev => ({ ...prev, ...d.data.config }))
          if (d.data.last_result)
            setScheduleLastResult(d.data.last_result)
        }
      })
      .catch(() => { })
  }, [])

  const saveSchedule = async () => {
    setScheduleSaving(true)
    try {
      await fetch('/api/marketing/prospect-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, schedule }),
      })
      setScheduleSaved(true)
      setTimeout(() => setScheduleSaved(false), 2000)
    } catch { /* skip */ } finally {
      setScheduleSaving(false)
    }
  }

  const setSched = <K extends keyof ProspectSchedule>(key: K, val: ProspectSchedule[K]) =>
    setSchedule(prev => ({ ...prev, [key]: val }))

  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [k]: !prev[k] }))

  const toggleSource = (s: CollectSource) =>
    setC('sources', config.sources.includes(s)
      ? config.sources.filter(x => x !== s)
      : [...config.sources, s])

  // ── Voice scripts CRUD ────────────────────────────────────────────────────

  const addScript = () => setC('voiceScripts', [...config.voiceScripts, {
    id: `script-${Date.now()}`, name: t('def.scriptN', { n: config.voiceScripts.length + 1 }),
    text: '', voiceId: 'EXAVITQu4vr4xnSDxMaL',
  }])

  const updateScript = (id: string, patch: Partial<VoiceScript>) =>
    setC('voiceScripts', config.voiceScripts.map(s => s.id === id ? { ...s, ...patch } : s))

  const removeScript = (id: string) =>
    setC('voiceScripts', config.voiceScripts.filter(s => s.id !== id))

  // ── Routing rules CRUD ────────────────────────────────────────────────────

  const addRule = () => setC('routingRules', [...config.routingRules, {
    id: `rule-${Date.now()}`,
    name: t('def.ruleN', { n: config.routingRules.length + 1 }),
    condition: { ...EMPTY_CONDITION },
    scriptId: config.voiceScripts[0]?.id ?? '',
  }])

  const updateRule = (id: string, patch: Partial<RoutingRule>) =>
    setC('routingRules', config.routingRules.map(r => r.id === id ? { ...r, ...patch } : r))

  const removeRule = (id: string) =>
    setC('routingRules', config.routingRules.filter(r => r.id !== id))

  // ── Email templates CRUD ─────────────────────────────────────────────────

  const addEmailTemplate = () => setC('emailTemplates', [...config.emailTemplates, {
    id: `email-${Date.now()}`, name: t('def.templateN', { n: config.emailTemplates.length + 1 }),
    subject: '', body: '',
  }])

  const updateEmailTemplate = (id: string, patch: Partial<EmailTemplate>) =>
    setC('emailTemplates', config.emailTemplates.map(t => t.id === id ? { ...t, ...patch } : t))

  const removeEmailTemplate = (id: string) =>
    setC('emailTemplates', config.emailTemplates.filter(t => t.id !== id))

  // ── Email rules CRUD ─────────────────────────────────────────────────────

  const addEmailRule = () => setC('emailRules', [...(config.emailRules ?? []), {
    id: `erule-${Date.now()}`,
    name: t('def.categoryN', { n: (config.emailRules ?? []).length + 1 }),
    desc: '',
    templateId: config.emailTemplates[0]?.id ?? '',
    customTag: '',
    minEmployees: 0,
    maxEmployees: 0,
  }])

  const updateEmailRule = (id: string, patch: Partial<EmailRule>) =>
    setC('emailRules', (config.emailRules ?? []).map(r => r.id === id ? { ...r, ...patch } : r))

  const removeEmailRule = (id: string) =>
    setC('emailRules', (config.emailRules ?? []).filter(r => r.id !== id))

  // ── Batch email send ──────────────────────────────────────────────────────

  /** Match org against an EmailRule (first-match logic) */
  const matchEmailRule = (org: ProspectOrg, rule: EmailRule): boolean => {
    if (rule.customTag.trim()) {
      const tag = rule.customTag.trim().toLowerCase()
      const hay = `${org.name} ${org.rawCategory ?? ''}`.toLowerCase()
      if (!hay.includes(tag)) return false
    }
    if (rule.minEmployees > 0) {
      const emp = parseMaxEmployees(org.employeeHint)
      if (emp === null || emp < rule.minEmployees) return false
    }
    if (rule.maxEmployees > 0) {
      const emp = parseMaxEmployees(org.employeeHint)
      if (emp === null || emp > rule.maxEmployees) return false
    }
    return true
  }

  /** Returns the first matching email rule for an org */
  const assignEmailRule = (org: ProspectOrg): EmailRule | undefined => {
    for (const rule of (config.emailRules ?? [])) {
      if (matchEmailRule(org, rule)) return rule
    }
    return undefined
  }

  const batchEmail = async (rule: EmailRule, template: EmailTemplate) => {
    const targetOrgs = selectedOrgs.filter(o => {
      const emailAddr = orgEmails[o.id] || o.email
      if (!emailAddr) return false
      return matchEmailRule(o, rule)
    })
    if (targetOrgs.length === 0) { setError(t('err.noEmailOrgs')); return }
    setSendingEmail(rule.id)
    try {
      const recipients = targetOrgs.map(o => ({
        email: orgEmails[o.id] || o.email!,
        group: rule.name,
        name: o.name,
      }))
      const res = await fetch('/api/marketing/email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          groups: {},
          defaultSubject: template.subject,
          defaultBody: template.body,
          fromName: config.fromName,
          fromEmail: config.fromEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmailResults(prev => ({ ...prev, [rule.id]: { ok: data.success, fail: data.total - data.success } }))
    } catch (e) {
      setError(String(e))
    } finally {
      setSendingEmail(null)
    }
  }

  // ── Org → rule assignment (first-match wins) ──────────────────────────────

  const assignRules = (orgList: ProspectOrg[]): Record<string, string> => {
    const map: Record<string, string> = {} // orgId → ruleId
    for (const org of orgList) {
      for (const rule of config.routingRules) {
        if (matchRule(org, rule)) {
          map[org.id] = rule.id
          break
        }
      }
    }
    return map
  }

  // ── Run pipeline ──────────────────────────────────────────────────────────

  const runPipeline = async () => {
    if (!config.keywords.trim()) { setError(t('err.noKeywords')); return }
    setError(''); setRunning(true); abortRef.current = false
    setOrgs([]); setCallResults({})
    setStepStatus({ collect: 'running', filter: 'idle', done: 'idle' })
    setStepMsg({})

    try {
      const sourceToTypes: Record<CollectSource, string> = {
        map: 'map', facebook: 'facebook', instagram: 'instagram',
        tiktok: 'tiktok', youtube: 'youtube', threads: 'threads',
        amazon: 'amazon', shopee: 'shopee', ios_android: 'ios_android', web: 'web',
      }
      const types = config.sources.map(s => sourceToTypes[s])
      const subOptions: Record<string, string[]> = {}
      if (config.sources.includes('map'))        subOptions.map        = ['info', 'coordinates']
      if (config.sources.includes('facebook'))   subOptions.facebook   = ['vendor_info', 'posts']
      if (config.sources.includes('instagram'))  subOptions.instagram  = ['vendor_info', 'posts']
      if (config.sources.includes('tiktok'))     subOptions.tiktok     = ['vendor_info', 'videos']
      if (config.sources.includes('youtube'))    subOptions.youtube    = ['vendor_info', 'videos']
      if (config.sources.includes('threads'))    subOptions.threads    = ['vendor_info', 'posts']
      if (config.sources.includes('amazon'))     subOptions.amazon     = ['vendor_info', 'products']
      if (config.sources.includes('shopee'))     subOptions.shopee     = ['vendor_info', 'products']
      if (config.sources.includes('ios_android')) subOptions.ios_android = ['vendor_info', 'reviews']

      const collectRes = await fetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types, subOptions,
          keywords: config.keywords,
          location: config.location,
          limit: config.collectLimit,
        }),
      })
      const collectData = await collectRes.json()
      if (!collectRes.ok) throw new Error(collectData.error || t('err.collectFailed'))
      const rawText: string = collectData.raw || collectData.result || collectData.summary || ''
      setStepStatus(p => ({ ...p, collect: 'done', filter: 'running' }))
      setStepMsg(p => ({ ...p, collect: t('msg.collected', { count: rawText.length }) }))

      if (abortRef.current) throw new Error(t('err.aborted'))

      const filterRes = await fetch('/api/marketing/prospect-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          filterCriteria: config.filterCriteria,
          minEmployees: config.minEmployees,
          maxDistanceKm: config.distanceEnabled ? config.maxDistanceKm : 0,
          branches,
        }),
      })
      const filterData = await filterRes.json()
      if (!filterRes.ok) throw new Error(filterData.error || t('err.aiFailed'))
      const result: ProspectOrg[] = filterData.orgs || []
      setOrgs(result)
      const selected = result.filter(o => o.selected)
      setStepStatus(p => ({ ...p, filter: 'done', call: 'running' }))
      setStepMsg(p => ({ ...p, filter: t('msg.selected', { selected: selected.length, total: result.length }) }))

      // ── 自動依規則撥打 ──────────────────────────────────────────────────────
      // 計算每個 org 對應的規則（inline，不依賴 React state）
      const orgRuleMapLocal: Record<string, string> = {}
      for (const org of selected) {
        for (const rule of config.routingRules) {
          if (matchRule(org, rule)) { orgRuleMapLocal[org.id] = rule.id; break }
        }
      }

      let totalCalled = 0
      for (const rule of config.routingRules) {
        if (!rule.scriptId) continue
        const script = config.voiceScripts.find(s => s.id === rule.scriptId)
        if (!script) continue
        const phones = selected
          .filter(o => orgRuleMapLocal[o.id] === rule.id && o.phoneNormalized)
          .map(o => o.phoneNormalized!)
        if (phones.length === 0) continue
        try {
          const res = await fetch('/api/marketing/phone-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'batch',
              script: script.text,
              phones,
              voiceId: script.voiceId,
              birdCallerId: config.birdCallerId,
            }),
          })
          const data = await res.json()
          if (res.ok) {
            setCallResults(prev => ({
              ...prev,
              [rule.id]: { ok: data.success ?? 0, fail: (data.total ?? 0) - (data.success ?? 0) },
            }))
            totalCalled += phones.length
          }
        } catch (e) {
          setError(String(e))  // 顯示錯誤（如 Bird Caller ID 未填、API Key 未設）
        }
      }

      setStepStatus(p => ({ ...p, call: 'done', done: 'done' }))
      setStepMsg(p => ({ ...p, call: t('msg.called', { count: totalCalled }) }))

    } catch (e) {
      const msg = String(e)
      setError(msg)
      setStepStatus(p => {
        const current = Object.entries(p).find(([, v]) => v === 'running')
        if (!current) return p
        return { ...p, [current[0]]: 'error' }
      })
    } finally {
      setRunning(false)
    }
  }

  // ── Batch call by rule ────────────────────────────────────────────────────

  const batchCall = async (ruleId: string, phones: string[], script: VoiceScript) => {
    setCallingRule(ruleId)
    try {
      const res = await fetch('/api/marketing/phone-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          script: script.text,
          phones,
          voiceId: script.voiceId,
          birdCallerId: config.birdCallerId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCallResults(prev => ({
        ...prev,
        [ruleId]: { ok: data.success ?? 0, fail: (data.total ?? 0) - (data.success ?? 0) },
      }))
    } catch (e) {
      setError(String(e))
    } finally {
      setCallingRule(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedOrgs = orgs.filter(o => o.selected)
  const orgRuleMap = assignRules(selectedOrgs)

  const byRule = config.routingRules
    .map(rule => {
      const matched = selectedOrgs.filter(o => orgRuleMap[o.id] === rule.id)
      const script = config.voiceScripts.find(s => s.id === rule.scriptId)
      return { rule, matched, script }
    })
    .filter(x => x.matched.length > 0)

  const unmapped = selectedOrgs.filter(o => !orgRuleMap[o.id])

  const branchesWithCoords = branches.filter(b => b.lat && b.lng)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />{t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {([['phone', `📞 ${t('tabPhone')}`], ['email', `📧 ${t('tabEmail')}`], ['schedule', `⏱ ${t('tabSchedule')}`]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Schedule Tab ── */}
        {activeTab === 'schedule' && (
          <div className="max-w-lg space-y-5">
            {/* Enable toggle */}
            <div className="border rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t('sched.enable')}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t('sched.enableHint')}</div>
              </div>
              <button type="button" onClick={() => setSched('enabled', !schedule.enabled)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ background: schedule.enabled ? 'var(--primary)' : '#d1d5db' }}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${schedule.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {schedule.enabled && (
              <div className="border rounded-xl p-5 space-y-4">
                {/* Mode */}
                <div>
                  <label className="block text-xs font-medium mb-2">{t('sched.mode')}</label>
                  <div className="flex gap-2">
                    {([
                      { val: 'phone', label: `📞 ${t('tabPhone')}` },
                      { val: 'email', label: `📧 ${t('tabEmail')}` },
                      { val: 'both',  label: `🔀 ${t('sched.modeBoth')}` },
                    ] as const).map(opt => (
                      <button key={opt.val} type="button" onClick={() => setSched('mode', opt.val)}
                        className="flex-1 py-2 rounded-lg text-sm border transition-all font-medium"
                        style={schedule.mode === opt.val
                          ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {schedule.mode === 'phone' && t('sched.modePhoneHint')}
                    {schedule.mode === 'email' && t('sched.modeEmailHint')}
                    {schedule.mode === 'both'  && t('sched.modeBothHint')}
                  </p>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-xs font-medium mb-2">{t('sched.frequency')}</label>
                  <div className="flex gap-2">
                    {([{ val: 'daily', label: t('sched.daily') }, { val: 'weekly', label: t('sched.weekly') }, { val: 'monthly', label: t('sched.monthly') }] as const).map(opt => (
                      <button key={opt.val} type="button" onClick={() => setSched('frequency', opt.val)}
                        className="flex-1 py-2 rounded-lg text-sm border transition-all font-medium"
                        style={schedule.frequency === opt.val
                          ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weekday */}
                {schedule.frequency === 'weekly' && (
                  <div>
                    <label className="block text-xs font-medium mb-2">{t('sched.weekday')}</label>
                    <div className="flex gap-1">
                      {[0,1,2,3,4,5,6].map(i => (
                        <button key={i} type="button" onClick={() => setSched('weekday', i)}
                          className="flex-1 py-2 rounded-lg text-sm border transition-all"
                          style={schedule.weekday === i
                            ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', fontWeight: 600 }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {t(`sched.dow.${i}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Month day */}
                {schedule.frequency === 'monthly' && (
                  <div>
                    <label className="block text-xs font-medium mb-2">{t('sched.monthDay')}</label>
                    <input type="number" min={1} max={28} value={schedule.monthDay}
                      onChange={e => setSched('monthDay', Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                    <p className="text-[11px] text-gray-400 mt-1">{t('sched.monthDayHint')}</p>
                  </div>
                )}

                {/* Time */}
                <div>
                  <label className="block text-xs font-medium mb-2">{t('sched.time')}</label>
                  <div className="flex gap-3">
                    <select value={schedule.hour} onChange={e => setSched('hour', Number(e.target.value))}
                      className="flex-1 h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{t('sched.hourUnit', { h: String(i).padStart(2,'0') })}</option>
                      ))}
                    </select>
                    <select value={schedule.minute} onChange={e => setSched('minute', Number(e.target.value))}
                      className="flex-1 h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white">
                      {[0,15,30,45].map(m => (
                        <option key={m} value={m}>{t('sched.minUnit', { m: String(m).padStart(2,'0') })}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            {(schedule.nextRunAt || schedule.lastRunAt || scheduleLastResult) && (
              <div className="border rounded-xl p-4 space-y-2 bg-blue-50 border-blue-100">
                <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />{t('sched.statusTitle')}
                </div>
                {schedule.lastRunAt && (
                  <div className="text-xs text-gray-600">{t('sched.lastRun')}<span className="font-medium">{new Date(schedule.lastRunAt).toLocaleString(locale)}</span></div>
                )}
                {schedule.nextRunAt && (
                  <div className="text-xs text-blue-700">{t('sched.nextRun')}<span className="font-semibold">{new Date(schedule.nextRunAt).toLocaleString(locale)}</span></div>
                )}
                {scheduleLastResult && (
                  <div className="text-xs text-gray-600 pt-1 border-t border-blue-200">
                    {t('sched.lastResult', { total: scheduleLastResult.total })}<span className="text-green-600 font-semibold">{scheduleLastResult.selected}</span>{t('sched.lastResultSuffix')}
                  </div>
                )}
              </div>
            )}

            {/* Save */}
            <button type="button" onClick={saveSchedule} disabled={scheduleSaving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}>
              {scheduleSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{t('sched.saving')}</>
                : scheduleSaved ? <><CheckCircle2 className="h-4 w-4" />{t('sched.saved')}</>
                : <><Save className="h-4 w-4" />{t('sched.save')}</>}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              {t('sched.saveHint')}
            </p>
          </div>
        )}

        {/* ── Phone / Email grid ── */}
        {activeTab !== 'schedule' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Configuration ── */}
          <div className="space-y-3">

            {/* Step 1: Collect */}
            <Section title={t('s1.title')} icon={Search}
              open={openSections.collect} onToggle={() => toggleSection('collect')}>
              <div>
                <label className="block text-xs font-medium mb-1">{t('s1.keywords')}</label>
                <textarea value={config.keywords} onChange={e => setC('keywords', e.target.value)}
                  rows={3} placeholder={t('s1.keywordsPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none" />
                <p className="text-xs text-gray-400 mt-0.5">{t('s1.keywordsHint')}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('s1.location')}</label>
                <input value={config.location} onChange={e => setC('location', e.target.value)}
                  placeholder={t('s1.locationPlaceholder')}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1">{t('s1.limit')}</label>
                  <input type="number" min={10} max={500} step={10} value={config.collectLimit}
                    onChange={e => setC('collectLimit', Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                  <p className="text-xs text-gray-400 mt-0.5">{t('s1.limitHint')}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">{t('s1.channels')}</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'map'        as CollectSource, label: `🗺️ ${t('src.map')}` },
                    { id: 'facebook'   as CollectSource, label: '👥 Facebook' },
                    { id: 'instagram'  as CollectSource, label: '📸 Instagram' },
                    { id: 'tiktok'     as CollectSource, label: '📱 TikTok' },
                    { id: 'youtube'    as CollectSource, label: '🎬 YouTube' },
                    { id: 'threads'    as CollectSource, label: '🧵 Threads' },
                    { id: 'amazon'     as CollectSource, label: '📦 Amazon' },
                    { id: 'shopee'     as CollectSource, label: '🛒 Shopee' },
                    { id: 'ios_android' as CollectSource, label: '📲 iOS/Android' },
                    { id: 'web'        as CollectSource, label: `🌐 ${t('src.web')}` },
                  ]).map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSource(s.id)}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                      style={config.sources.includes(s.id)
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : {}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Step 2: Filter */}
            <Section title={t('s2.title')} icon={Filter}
              open={openSections.filter} onToggle={() => toggleSection('filter')}>
              <div>
                <label className="block text-xs font-medium mb-1">{t('s2.criteria')}</label>
                <textarea value={config.filterCriteria}
                  onChange={e => setC('filterCriteria', e.target.value)}
                  rows={2} placeholder={t('s2.criteriaPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('s2.minEmp')}</label>
                <input type="number" min={0} value={config.minEmployees}
                  onChange={e => setC('minEmployees', Number(e.target.value))}
                  placeholder={t('s2.unlimited')}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </Section>

            {/* Step 3: Distance */}
            <Section title={t('s3.title')} icon={MapPin}
              open={openSections.distance} onToggle={() => toggleSection('distance')}>
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{t('s3.enable')}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t('s3.enableHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setC('distanceEnabled', !config.distanceEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                    config.distanceEnabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    config.distanceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 門市狀態 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                {branches.length === 0
                  ? <span>{t('s3.noBranches')}</span>
                  : <span>{t.rich('s3.branchesLoaded', { total: branches.length, coords: branchesWithCoords.length, b: (c) => <strong>{c}</strong> })}</span>
                }
              </div>

              {/* 距離輸入（僅啟用時顯示） */}
              {config.distanceEnabled && (
                <div>
                  <label className="block text-xs font-medium mb-1">{t('s3.maxDist')}</label>
                  <input type="number" min={0.5} step={0.5} value={config.maxDistanceKm}
                    onChange={e => setC('maxDistanceKm', Number(e.target.value))}
                    placeholder={t('s3.maxDistPlaceholder')}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t('s3.maxDistHint')}
                  </p>
                </div>
              )}
            </Section>

            {/* ── Phone-only steps ── */}
            {activeTab === 'phone' && <>

            {/* Step 4: Voice scripts */}
            <Section title={t('s4p.title')} icon={Mic}
              open={openSections.scripts} onToggle={() => toggleSection('scripts')}>
              <div className="space-y-3">
                {config.voiceScripts.map(s => (
                  <div key={s.id} className="p-3 rounded-xl border space-y-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input value={s.name} onChange={e => updateScript(s.id, { name: e.target.value })}
                        className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                        placeholder={t('s4p.scriptName')} />
                      {config.voiceScripts.length > 1 && (
                        <button type="button" onClick={() => removeScript(s.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea value={s.text} onChange={e => updateScript(s.id, { text: e.target.value })}
                      rows={3} placeholder={t('s4p.scriptTextPlaceholder')}
                      className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 resize-none bg-white" />
                    <select value={s.voiceId} onChange={e => updateScript(s.id, { voiceId: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white">
                      {ELEVEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} — {t(v.descKey)}</option>)}
                    </select>
                  </div>
                ))}
                <button type="button" onClick={addScript}
                  className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 transition-colors justify-center">
                  <Plus className="h-3.5 w-3.5" />{t('s4p.addScript')}
                </button>
              </div>
            </Section>

            {/* Step 5: Routing rules */}
            <Section title={t('s5p.title')} icon={Settings2}
              open={openSections.mapping} onToggle={() => toggleSection('mapping')}>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  {t.rich('s5p.hint1', { b: (c) => <strong>{c}</strong> })}
                </p>
                <p className="text-[10px] text-gray-400">
                  {t('s5p.hint2')}
                </p>
              </div>

              <div className="space-y-3">
                {config.routingRules.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-4 border-2 border-dashed rounded-xl">
                    {t('s5p.empty')}
                  </div>
                )}
                {config.routingRules.map((rule, idx) => (
                  <RoutingRuleEditor
                    key={rule.id}
                    rule={rule}
                    voiceScripts={config.voiceScripts}
                    index={idx}
                    onChange={patch => updateRule(rule.id, patch)}
                    onRemove={() => removeRule(rule.id)}
                  />
                ))}
                <button type="button" onClick={addRule}
                  className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 transition-colors justify-center">
                  <Plus className="h-3.5 w-3.5" />{t('s5p.addRule')}
                </button>
              </div>
            </Section>

            {/* Step 6: Call config */}
            <Section title={t('s6p.title')} icon={Phone}
              open={openSections.call} onToggle={() => toggleSection('call')}>
              <div className="space-y-4">
                {/* Caller ID */}
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {t('s6p.callerId')}
                    <span className="ml-1 text-[10px] text-gray-400 font-normal">{t('s6p.callerIdHint')}</span>
                  </label>
                  <input value={config.birdCallerId} onChange={e => setC('birdCallerId', e.target.value)}
                    placeholder="+886xxxxxxxxx / +84xxxxxxxxx"
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                  {!config.birdCallerId.trim() && (
                    <p className="text-[10px] text-amber-500 mt-1">{t('s6p.callerIdWarn')}</p>
                  )}
                </div>

                {/* 待撥清單預覽 */}
                {selectedOrgs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 text-gray-700">
                      {t('s6p.dialList', { count: selectedOrgs.filter(o => o.phoneNormalized).length })}
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">{t('s6p.fromFilter')}</span>
                    </p>
                    {config.routingRules.length === 0 ? (
                      <p className="text-[10px] text-gray-400">{t('s6p.needRules')}</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {config.routingRules.map(rule => {
                          const matched = selectedOrgs.filter(o => orgRuleMap[o.id] === rule.id)
                          const hasPhone = matched.filter(o => o.phoneNormalized)
                          const noPhone = matched.filter(o => !o.phoneNormalized)
                          if (matched.length === 0) return null
                          return (
                            <div key={rule.id} className="rounded-lg border bg-gray-50 p-2 text-[11px]">
                              <div className="font-medium text-gray-700 mb-1">
                                {rule.name}
                                <span className="ml-1 text-gray-400">· {t('s6p.dialable', { has: hasPhone.length, no: noPhone.length })}</span>
                              </div>
                              {hasPhone.slice(0, 5).map(o => (
                                <div key={o.id} className="flex items-center gap-1.5 py-0.5 border-t border-gray-100 first:border-0">
                                  <Phone className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                                  <span className="text-green-700 font-mono">{o.phoneNormalized}</span>
                                  <span className="text-gray-400 truncate">{o.name}</span>
                                </div>
                              ))}
                              {hasPhone.length > 5 && (
                                <p className="text-gray-400 text-[10px] mt-0.5">{t('s6p.andMore', { count: hasPhone.length - 5 })}</p>
                              )}
                              {noPhone.length > 0 && (
                                <div className="mt-1 text-gray-400">
                                  {t('s6p.noPhonePrefix')}{noPhone.map(o => o.name).join('、').slice(0, 60)}{noPhone.length > 3 ? '…' : ''}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {unmapped.length > 0 && (
                          <div className="rounded-lg border bg-amber-50 p-2 text-[11px] text-amber-700">
                            {t('s6p.unmappedNoCall', { count: unmapped.length })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {selectedOrgs.length === 0 && orgs.length > 0 && (
                  <p className="text-[10px] text-gray-400">{t('s6p.noSelected')}</p>
                )}
                {orgs.length === 0 && (
                  <p className="text-[10px] text-gray-400">{t('s6p.runFirst')}</p>
                )}
              </div>
            </Section>

            </>}

            {/* ── Email-only steps ── */}
            {activeTab === 'email' && <>

            {/* Step 4: Email templates */}
            <Section title={t('s4e.title')} icon={Mail}
              open={openSections.emailTemplates} onToggle={() => toggleSection('emailTemplates')}>
              <p className="text-xs text-gray-500">{t('s4e.hint')}</p>
              <div className="space-y-3">
                {config.emailTemplates.map(tpl => (
                  <div key={tpl.id} className="p-3 rounded-xl border space-y-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input value={tpl.name} onChange={e => updateEmailTemplate(tpl.id, { name: e.target.value })}
                        className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-semibold"
                        placeholder={t('s4e.templateName')} />
                      {config.emailTemplates.length > 1 && (
                        <button type="button" onClick={() => removeEmailTemplate(tpl.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <input value={tpl.subject} onChange={e => updateEmailTemplate(tpl.id, { subject: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                      placeholder={t('s4e.subject')} />
                    <textarea value={tpl.body} onChange={e => updateEmailTemplate(tpl.id, { body: e.target.value })}
                      rows={4} placeholder={t('s4e.body')}
                      className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 resize-none bg-white" />
                  </div>
                ))}
                <button type="button" onClick={addEmailTemplate}
                  className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 justify-center">
                  <Plus className="h-3.5 w-3.5" />{t('s4e.addTemplate')}
                </button>
              </div>
            </Section>

            {/* Step 5: Email sending rules */}
            <Section title={t('s5e.title')} icon={Settings2}
              open={openSections.emailRules} onToggle={() => toggleSection('emailRules')}>
              <p className="text-xs text-gray-500">{t('s5e.hint')}</p>
              <div className="space-y-3">
                {(config.emailRules ?? []).map((rule, idx) => (
                  <div key={rule.id} className="p-3 rounded-xl border space-y-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 w-5">{idx + 1}</span>
                      <input value={rule.name} onChange={e => updateEmailRule(rule.id, { name: e.target.value })}
                        className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-semibold"
                        placeholder={t('s5e.categoryName')} />
                      {(config.emailRules ?? []).length > 1 && (
                        <button type="button" onClick={() => removeEmailRule(rule.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">{t('rule.customTag')}</label>
                      <input value={rule.customTag} onChange={e => updateEmailRule(rule.id, { customTag: e.target.value })}
                        className="w-full h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                        placeholder={t('s5e.tagPlaceholder')} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">{t('rule.minEmp')}</label>
                        <input type="number" min={0} value={rule.minEmployees}
                          onChange={e => updateEmailRule(rule.id, { minEmployees: Number(e.target.value) })}
                          className="w-full h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">{t('rule.maxEmp')}</label>
                        <input type="number" min={0} value={rule.maxEmployees}
                          onChange={e => updateEmailRule(rule.id, { maxEmployees: Number(e.target.value) })}
                          className="w-full h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">{t('s5e.applyTemplate')}</label>
                      <select value={rule.templateId} onChange={e => updateEmailRule(rule.id, { templateId: e.target.value })}
                        className="w-full h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white">
                        {config.emailTemplates.map((tpl, ti) => (
                          <option key={tpl.id} value={tpl.id}>{tpl.name || t('def.templateN', { n: ti + 1 })}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addEmailRule}
                  className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 justify-center">
                  <Plus className="h-3.5 w-3.5" />{t('s5p.addRule')}
                </button>
              </div>
            </Section>

            {/* Step 6: Email sender settings */}
            <Section title={t('s6e.title')} icon={Mail}
              open={openSections.emailSettings} onToggle={() => toggleSection('emailSettings')}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">{t('s6e.fromName')}</label>
                  <input value={config.fromName} onChange={e => setC('fromName', e.target.value)}
                    placeholder={t('def.marketingTeam')} className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{t('s6e.fromEmail')}</label>
                  <input value={config.fromEmail} onChange={e => setC('fromEmail', e.target.value)}
                    placeholder="marketing@yourdomain.com"
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                </div>
                <div className="text-[10px] text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  {t('s6e.envNote')}<code className="font-mono">RESEND_API_KEY</code>
                </div>
              </div>
            </Section>

            </>}

          </div>

          {/* ── Right: Run + Results ── */}
          <div className="space-y-4">

            {/* Run button + progress */}
            <div className="p-4 rounded-xl border bg-card space-y-4">
              <button type="button" onClick={runPipeline} disabled={running}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                style={{ background: 'var(--primary)' }}>
                {running ? <><Loader2 className="h-4 w-4 animate-spin" />{t('run.running')}</> : <><Play className="h-4 w-4" />{t('run.exec')}</>}
              </button>

              {(Object.keys(stepStatus).length > 0) && (
                <div className="grid grid-cols-3 gap-2">
                  <StepBadge status={stepStatus.collect ?? 'idle'}
                    label={`${t('run.collect')}${stepMsg.collect ? ` · ${stepMsg.collect}` : ''}`} />
                  <StepBadge status={stepStatus.filter ?? 'idle'}
                    label={`${t('run.analyze')}${stepMsg.filter ? ` · ${stepMsg.filter}` : ''}`} />
                  <StepBadge status={stepStatus.call ?? 'idle'}
                    label={`${t('run.call')}${stepMsg.call ? ` · ${stepMsg.call}` : ''}`} />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>

            {/* Summary stats */}
            {orgs.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('stat.total'), value: orgs.length, color: 'text-gray-700' },
                  { label: t('stat.selected'), value: selectedOrgs.length, color: 'text-green-600' },
                  { label: t('stat.rejected'), value: orgs.length - selectedOrgs.length, color: 'text-red-500' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl border text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Email right panel ── */}
            {activeTab === 'email' && selectedOrgs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">{t('email.sendTitle')}</h3>

                {/* Email input table */}
                {selectedOrgs.filter(o => o.email || (orgEmails[o.id] ?? '')).length === 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 space-y-1">
                    <p className="font-medium">{t('email.noEmailTitle')}</p>
                    <p>{t.rich('email.noEmailHint', { b: (c) => <strong>{c}</strong> })}</p>
                    <p>{t('email.manualHint')}</p>
                  </div>
                )}
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-500 font-medium flex items-center justify-between">
                    <span>{t('email.perOrgEmail')}</span>
                    <span className="text-gray-400">
                      {t('email.filledCount', { filled: selectedOrgs.filter(o => o.email || orgEmails[o.id]).length, total: selectedOrgs.length })}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {selectedOrgs.map(o => (
                      <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{o.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji} {catLabel(t, o.aiCategory)}
                          </div>
                        </div>
                        <input
                          value={orgEmails[o.id] ?? o.email ?? ''}
                          onChange={e => setOrgEmails(prev => ({ ...prev, [o.id]: e.target.value }))}
                          placeholder="email@example.com"
                          className="w-44 h-7 px-2 rounded-lg border text-xs outline-none focus:ring-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rule-based send panels */}
                {(config.emailRules ?? []).map(rule => {
                  const tpl = config.emailTemplates.find(t => t.id === rule.templateId)
                  const targets = selectedOrgs.filter(o => {
                    const addr = orgEmails[o.id] || o.email
                    if (!addr) return false
                    return matchEmailRule(o, rule)
                  })
                  const result = emailResults[rule.id]
                  const isSending = sendingEmail === rule.id
                  return (
                    <div key={rule.id} className="p-4 rounded-xl border space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{rule.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {t('email.templateLabel', { name: tpl?.name ?? t('email.notSet') })}{' · '}{t('email.hasEmail', { count: targets.length })}
                          </div>
                        </div>
                        <button type="button"
                          onClick={() => tpl && batchEmail(rule, tpl)}
                          disabled={isSending || targets.length === 0 || !tpl?.subject || !tpl?.body}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                          style={{ background: 'var(--primary)' }}>
                          {isSending ? <><Loader2 className="h-3 w-3 animate-spin" />{t('email.sending')}</> : <><Mail className="h-3 w-3" />{t('email.sendN', { count: targets.length })}</>}
                        </button>
                      </div>
                      {tpl?.subject && (
                        <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg">
                          {t('email.subjectPrefix')}{tpl.subject.slice(0, 60)}{tpl.subject.length > 60 ? '…' : ''}
                        </div>
                      )}
                      {result && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-green-600">{t('res.success', { n: result.ok })}</span>
                          {result.fail > 0 && <span className="text-red-500">{t('res.fail', { n: result.fail })}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Phone right panel ── */}
            {/* By-rule call panels */}
            {activeTab === 'phone' && byRule.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">{t('phone.groupTitle')}</h3>
                {byRule.map(({ rule, matched, script }) => {
                  const phones = matched.filter(o => o.phoneNormalized).map(o => o.phoneNormalized!)
                  const result = callResults[rule.id]
                  const isCalling = callingRule === rule.id
                  return (
                    <div key={rule.id} className="p-4 rounded-xl border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{rule.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {conditionSummary(rule.condition, t)} · {t('phone.matchedPhones', { matched: matched.length, phones: phones.length })}
                          </div>
                        </div>
                        {script ? (
                          <button type="button"
                            onClick={() => batchCall(rule.id, phones, script)}
                            disabled={isCalling || phones.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isCalling ? <><Loader2 className="h-3 w-3 animate-spin" />{t('phone.calling')}</> : <><PhoneCall className="h-3 w-3" />{t('phone.callN', { count: phones.length })}</>}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 px-2">{t('phone.noScript')}</span>
                        )}
                      </div>
                      {script && (
                        <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg">
                          {t('phone.scriptPrefix')}{script.name}
                        </div>
                      )}
                      {result && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-green-600">{t('res.success', { n: result.ok })}</span>
                          {result.fail > 0 && <span className="text-red-500">{t('res.fail', { n: result.fail })}</span>}
                        </div>
                      )}
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {matched.map(o => (
                          <div key={o.id} className="flex items-start gap-2 text-[11px] py-1 border-t first:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{o.name}</div>
                              {o.address && <div className="text-gray-400 truncate">{o.address}</div>}
                              {o.employeeHint && <div className="text-gray-400">{o.employeeHint}</div>}
                            </div>
                            <div className="flex-shrink-0 text-right space-y-0.5">
                              {o.phoneNormalized
                                ? <div className="text-green-600">{isMobile(o.phoneNormalized) ? '📱' : '☎️'} {o.phoneNormalized}</div>
                                : <div className="text-gray-300">{t('phone.noPhone')}</div>
                              }
                              {o.nearestBranch && (
                                <div className="text-gray-400">{o.nearestBranch} {o.nearestBranchDistance}km</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Unmapped orgs */}
            {activeTab === 'phone' && unmapped.length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
                  {t('phone.unmappedCount', { count: unmapped.length })}
                </summary>
                <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                  {unmapped.map(o => (
                    <div key={o.id} className="flex items-start gap-2 py-1 border-t first:border-0 text-[11px]">
                      <Users className="h-3 w-3 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{o.name}</div>
                        <div className="text-gray-400">
                          {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji} {catLabel(t, o.aiCategory)}
                          {o.phoneNormalized && ` · ${isMobile(o.phoneNormalized) ? '📱' : '☎️'} ${o.phoneNormalized}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Filtered-out orgs */}
            {activeTab === 'phone' && orgs.filter(o => !o.selected).length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
                  {t('phone.rejectedCount', { count: orgs.filter(o => !o.selected).length })}
                </summary>
                <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                  {orgs.filter(o => !o.selected).map(o => (
                    <div key={o.id} className="flex items-start gap-2 py-1 border-t first:border-0 text-[11px]">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{o.name}</div>
                        <div className="text-gray-400">{o.filterReason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* All selected orgs table */}
            {activeTab === 'phone' && selectedOrgs.length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-600 font-medium cursor-pointer hover:bg-gray-50 select-none">
                  {t('phone.selectedListCount', { count: selectedOrgs.length })}
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500">
                        <th className="px-3 py-2 text-left font-medium">{t('phone.colOrg')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('phone.colCategory')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('phone.colPhone')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('phone.colRule')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrgs.map(o => {
                        const ruleId = orgRuleMap[o.id]
                        const ruleName = ruleId ? config.routingRules.find(r => r.id === ruleId)?.name : undefined
                        return (
                          <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium">{o.name}</div>
                              {o.address && <div className="text-gray-400 truncate max-w-[150px]">{o.address}</div>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji}{' '}
                              {catLabel(t, o.aiCategory)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {o.phoneNormalized
                                ? <span className="text-green-600">{isMobile(o.phoneNormalized) ? '📱' : '☎️'} {o.phoneNormalized}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                              {ruleName ?? <span className="text-gray-300">{t('phone.unassigned')}</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </div>}

      </div>
    </div>
  )
}
