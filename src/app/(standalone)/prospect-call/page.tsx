'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search, Building2, MapPin, Phone, Play, Loader2,
  CheckCircle2, AlertCircle, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
  Filter, Users, Map, Globe, Mic, Settings2, PhoneCall, GripVertical,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CollectSource = 'map' | 'facebook' | 'web'
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
  rating?: number; website?: string
  nearestBranch?: string; nearestBranchDistance?: number
  selected: boolean; filterReason?: string
}

interface Config {
  keywords: string
  location: string
  sources: CollectSource[]
  filterCriteria: string
  minEmployees: number
  maxDistanceKm: number
  birdCallerId: string
  voiceScripts: VoiceScript[]
  routingRules: RoutingRule[]
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'factory',    label: '製造/工廠',  emoji: '🏭' },
  { id: 'hotel',      label: '住宿/民宿',  emoji: '🏨' },
  { id: 'restaurant', label: '餐飲/食品',  emoji: '🍽️' },
  { id: 'financial',  label: '金融/保險',  emoji: '🏦' },
  { id: 'retail',     label: '零售/商店',  emoji: '🛍️' },
  { id: 'healthcare', label: '醫療/診所',  emoji: '🏥' },
  { id: 'education',  label: '教育/培訓',  emoji: '🎓' },
  { id: 'realestate', label: '房地產',     emoji: '🏠' },
  { id: 'logistics',  label: '物流/運輸',  emoji: '🚚' },
  { id: 'other',      label: '其他',       emoji: '📋' },
]

const ELEVEN_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — 多語言，女' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — 多語言，男' },
  { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — 多語言，女' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — 英式英語，男' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily — 多語言，女' },
  { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica — 美式英語，女' },
]

const EMPTY_CONDITION: RuleCondition = {
  phoneType: 'any',
  aiCategory: '',
  minEmployees: 0,
  maxEmployees: 0,
  maxDistanceKm: 0,
}

const DEFAULT_CONFIG: Config = {
  keywords: '',
  location: '',
  sources: ['map'],
  filterCriteria: '',
  minEmployees: 0,
  maxDistanceKm: 5,
  birdCallerId: '',
  voiceScripts: [
    { id: 'script-1', name: '預設腳本', text: '您好，我們是...', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  ],
  routingRules: [],
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
  return true
}

function conditionSummary(c: RuleCondition): string {
  const parts: string[] = []
  if (c.phoneType === 'mobile') parts.push('行動電話')
  if (c.phoneType === 'landline') parts.push('座機')
  if (c.aiCategory) parts.push(CATEGORIES.find(x => x.id === c.aiCategory)?.label ?? c.aiCategory)
  if (c.minEmployees > 0 && c.maxEmployees > 0) parts.push(`${c.minEmployees}–${c.maxEmployees}人`)
  else if (c.minEmployees > 0) parts.push(`≥${c.minEmployees}人`)
  else if (c.maxEmployees > 0) parts.push(`≤${c.maxEmployees}人`)
  if (c.maxDistanceKm > 0) parts.push(`≤${c.maxDistanceKm}km`)
  return parts.length ? parts.join(' · ') : '（全部符合）'
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
          placeholder="規則名稱"
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
          <label className="block text-[10px] font-medium text-gray-500 mb-1">電話類型</label>
          <div className="flex gap-1">
            {([
              { val: 'any', label: '任何' },
              { val: 'mobile', label: '📱 行動電話' },
              { val: 'landline', label: '☎️ 座機' },
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
          <label className="block text-[10px] font-medium text-gray-500 mb-1">AI 分類</label>
          <select
            value={rule.condition.aiCategory}
            onChange={e => setC({ aiCategory: e.target.value })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          >
            <option value="">— 任何分類 —</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* Employee range */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">最少人數（0=不限）</label>
          <input
            type="number" min={0}
            value={rule.condition.minEmployees}
            onChange={e => setC({ minEmployees: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">最多人數（0=不限）</label>
          <input
            type="number" min={0}
            value={rule.condition.maxEmployees}
            onChange={e => setC({ maxEmployees: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>

        {/* Max distance */}
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">距離上限 km（0=不限）</label>
          <input
            type="number" min={0} step={0.5}
            value={rule.condition.maxDistanceKm}
            onChange={e => setC({ maxDistanceKm: Number(e.target.value) })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          />
        </div>

        {/* Script */}
        <div className="col-span-2 pt-1 border-t">
          <label className="block text-[10px] font-medium text-gray-500 mb-1">使用腳本</label>
          <select
            value={rule.scriptId}
            onChange={e => onChange({ scriptId: e.target.value })}
            className="w-full h-7 px-2 rounded-md border text-xs outline-none focus:ring-2 bg-white"
          >
            <option value="">— 不撥打 —</option>
            {voiceScripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="px-3 pb-2">
        <div className="text-[10px] text-gray-400 bg-white rounded px-2 py-1 border">
          條件：{conditionSummary(rule.condition)}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ProspectCallPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [branches, setBranches] = useState<Branch[]>([])
  const [openSections, setOpenSections] = useState({ collect: true, filter: true, distance: true, scripts: true, mapping: false, call: true })
  const [running, setRunning] = useState(false)
  const [stepStatus, setStepStatus] = useState<Record<string, StepStatus>>({})
  const [stepMsg, setStepMsg] = useState<Record<string, string>>({})
  const [orgs, setOrgs] = useState<ProspectOrg[]>([])
  const [callResults, setCallResults] = useState<Record<string, { ok: number; fail: number }>>({})
  const [callingRule, setCallingRule] = useState<string | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef(false)

  const setC = <K extends keyof Config>(key: K, val: Config[K]) =>
    setConfig(prev => ({ ...prev, [key]: val }))

  // Load branches from company_data
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => { if (d.data?.branches) setBranches(d.data.branches) })
      .catch(() => { })
  }, [])

  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [k]: !prev[k] }))

  const toggleSource = (s: CollectSource) =>
    setC('sources', config.sources.includes(s)
      ? config.sources.filter(x => x !== s)
      : [...config.sources, s])

  // ── Voice scripts CRUD ────────────────────────────────────────────────────

  const addScript = () => setC('voiceScripts', [...config.voiceScripts, {
    id: `script-${Date.now()}`, name: `腳本 ${config.voiceScripts.length + 1}`,
    text: '', voiceId: 'EXAVITQu4vr4xnSDxMaL',
  }])

  const updateScript = (id: string, patch: Partial<VoiceScript>) =>
    setC('voiceScripts', config.voiceScripts.map(s => s.id === id ? { ...s, ...patch } : s))

  const removeScript = (id: string) =>
    setC('voiceScripts', config.voiceScripts.filter(s => s.id !== id))

  // ── Routing rules CRUD ────────────────────────────────────────────────────

  const addRule = () => setC('routingRules', [...config.routingRules, {
    id: `rule-${Date.now()}`,
    name: `規則 ${config.routingRules.length + 1}`,
    condition: { ...EMPTY_CONDITION },
    scriptId: config.voiceScripts[0]?.id ?? '',
  }])

  const updateRule = (id: string, patch: Partial<RoutingRule>) =>
    setC('routingRules', config.routingRules.map(r => r.id === id ? { ...r, ...patch } : r))

  const removeRule = (id: string) =>
    setC('routingRules', config.routingRules.filter(r => r.id !== id))

  // ── Org → rule assignment (first-match wins) ──────────────────────────────

  const assignRules = (orgList: ProspectOrg[]): Map<string, string> => {
    const map = new Map<string, string>() // orgId → ruleId
    for (const org of orgList) {
      for (const rule of config.routingRules) {
        if (matchRule(org, rule)) {
          map.set(org.id, rule.id)
          break
        }
      }
    }
    return map
  }

  // ── Run pipeline ──────────────────────────────────────────────────────────

  const runPipeline = async () => {
    if (!config.keywords.trim()) { setError('請填寫搜尋關鍵字'); return }
    setError(''); setRunning(true); abortRef.current = false
    setOrgs([]); setCallResults({})
    setStepStatus({ collect: 'running', filter: 'idle', done: 'idle' })
    setStepMsg({})

    try {
      const sourceToTypes: Record<CollectSource, string> = {
        map: 'map', facebook: 'facebook', web: 'web',
      }
      const types = config.sources.map(s => sourceToTypes[s])
      const subOptions: Record<string, string[]> = {}
      if (config.sources.includes('map')) subOptions.map = ['info', 'coordinates']
      if (config.sources.includes('facebook')) subOptions.facebook = ['posts']

      const collectRes = await fetch('/api/marketing/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types, subOptions,
          keywords: config.keywords,
          location: config.location,
          limit: 20,
        }),
      })
      const collectData = await collectRes.json()
      if (!collectRes.ok) throw new Error(collectData.error || '蒐集失敗')
      const rawText: string = collectData.result || collectData.summary || ''
      setStepStatus(p => ({ ...p, collect: 'done', filter: 'running' }))
      setStepMsg(p => ({ ...p, collect: `已蒐集 ${rawText.length} 字元` }))

      if (abortRef.current) throw new Error('已中止')

      const filterRes = await fetch('/api/marketing/prospect-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          filterCriteria: config.filterCriteria,
          minEmployees: config.minEmployees,
          maxDistanceKm: config.maxDistanceKm,
          branches,
        }),
      })
      const filterData = await filterRes.json()
      if (!filterRes.ok) throw new Error(filterData.error || 'AI 分析失敗')
      const result: ProspectOrg[] = filterData.orgs || []
      setOrgs(result)
      const selected = result.filter(o => o.selected)
      setStepStatus(p => ({ ...p, filter: 'done', done: 'done' }))
      setStepMsg(p => ({ ...p, filter: `入選 ${selected.length} / ${result.length} 家` }))

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
      const matched = selectedOrgs.filter(o => orgRuleMap.get(o.id) === rule.id)
      const script = config.voiceScripts.find(s => s.id === rule.scriptId)
      return { rule, matched, script }
    })
    .filter(x => x.matched.length > 0)

  const unmapped = selectedOrgs.filter(o => !orgRuleMap.has(o.id))

  const branchesWithCoords = branches.filter(b => b.lat && b.lng)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-primary" />潛在客戶電話行銷
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            自動蒐集組織 → AI 篩選 + 分類 → 距離計算 → 分批語音撥打
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Configuration ── */}
          <div className="space-y-3">

            {/* Step 1: Collect */}
            <Section title="Step 1 — 蒐集來源" icon={Search}
              open={openSections.collect} onToggle={() => toggleSection('collect')}>
              <div>
                <label className="block text-xs font-medium mb-1">搜尋關鍵字 *</label>
                <input value={config.keywords} onChange={e => setC('keywords', e.target.value)}
                  placeholder="例如：台南工廠、苗栗民宿"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">地區（選填）</label>
                <input value={config.location} onChange={e => setC('location', e.target.value)}
                  placeholder="例如：台南市、新竹縣"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">蒐集管道</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'map' as CollectSource, label: '地圖', icon: Map },
                    { id: 'facebook' as CollectSource, label: 'Facebook', icon: Globe },
                    { id: 'web' as CollectSource, label: '網頁', icon: Search },
                  ]).map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSource(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
                      style={config.sources.includes(s.id)
                        ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }
                        : {}}>
                      <s.icon className="h-3 w-3" />{s.label}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Step 2: Filter */}
            <Section title="Step 2 — 篩選條件" icon={Filter}
              open={openSections.filter} onToggle={() => toggleSection('filter')}>
              <div>
                <label className="block text-xs font-medium mb-1">篩選條件（AI 理解）</label>
                <textarea value={config.filterCriteria}
                  onChange={e => setC('filterCriteria', e.target.value)}
                  rows={2} placeholder="例如：只要製造業和工廠；員工人數 50 人以上；排除小型個人工作室"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">最低員工人數</label>
                <input type="number" min={0} value={config.minEmployees}
                  onChange={e => setC('minEmployees', Number(e.target.value))}
                  placeholder="0 = 不限"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </Section>

            {/* Step 3: Distance */}
            <Section title="Step 3 — 距離設定" icon={MapPin}
              open={openSections.distance} onToggle={() => toggleSection('distance')}>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                {branches.length === 0
                  ? <span>尚未設定門市。請前往「行銷自動化 → 公司資料 → 門市/分公司」新增。</span>
                  : <span>已載入 <strong>{branches.length}</strong> 個門市，其中 <strong>{branchesWithCoords.length}</strong> 個有經緯度可計算距離。</span>
                }
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">距離上限（km）</label>
                <input type="number" min={0} step={0.5} value={config.maxDistanceKm}
                  onChange={e => setC('maxDistanceKm', Number(e.target.value))}
                  placeholder="0 = 不限距離"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
                <p className="text-[10px] text-gray-400 mt-1">
                  設為 0 或門市無經緯度時不淘汰；仍會顯示最近門市距離（若有座標）。
                </p>
              </div>
            </Section>

            {/* Step 4: Voice scripts */}
            <Section title="Step 4 — 語音腳本" icon={Mic}
              open={openSections.scripts} onToggle={() => toggleSection('scripts')}>
              <div className="space-y-3">
                {config.voiceScripts.map(s => (
                  <div key={s.id} className="p-3 rounded-xl border space-y-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input value={s.name} onChange={e => updateScript(s.id, { name: e.target.value })}
                        className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white"
                        placeholder="腳本名稱" />
                      {config.voiceScripts.length > 1 && (
                        <button type="button" onClick={() => removeScript(s.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea value={s.text} onChange={e => updateScript(s.id, { text: e.target.value })}
                      rows={3} placeholder="輸入語音腳本內容..."
                      className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 resize-none bg-white" />
                    <select value={s.voiceId} onChange={e => updateScript(s.id, { voiceId: e.target.value })}
                      className="w-full h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white">
                      {ELEVEN_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </div>
                ))}
                <button type="button" onClick={addScript}
                  className="flex items-center gap-1.5 w-full py-2 rounded-lg border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50 transition-colors justify-center">
                  <Plus className="h-3.5 w-3.5" />新增腳本
                </button>
              </div>
            </Section>

            {/* Step 5: Routing rules */}
            <Section title="Step 5 — 撥打規則" icon={Settings2}
              open={openSections.mapping} onToggle={() => toggleSection('mapping')}>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  依序比對每條規則，<strong>第一個符合的規則</strong>勝出。可按電話類型、AI 分類、人數、距離等任意組合。
                </p>
                <p className="text-[10px] text-gray-400">
                  未匹配任何規則的組織將歸入「未分配」群組，不會自動撥打。
                </p>
              </div>

              <div className="space-y-3">
                {config.routingRules.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-4 border-2 border-dashed rounded-xl">
                    尚未建立規則，點擊「新增規則」開始設定
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
                  <Plus className="h-3.5 w-3.5" />新增規則
                </button>
              </div>
            </Section>

            {/* Step 6: Call config */}
            <Section title="Step 6 — 撥話設定" icon={Phone}
              open={openSections.call} onToggle={() => toggleSection('call')}>
              <div>
                <label className="block text-xs font-medium mb-1">Bird 顯示號碼（Caller ID）</label>
                <input value={config.birdCallerId} onChange={e => setC('birdCallerId', e.target.value)}
                  placeholder="+886xxxxxxxxx"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2" />
              </div>
            </Section>
          </div>

          {/* ── Right: Run + Results ── */}
          <div className="space-y-4">

            {/* Run button + progress */}
            <div className="p-4 rounded-xl border bg-card space-y-4">
              <button type="button" onClick={runPipeline} disabled={running}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                style={{ background: 'var(--primary)' }}>
                {running ? <><Loader2 className="h-4 w-4 animate-spin" />執行中…</> : <><Play className="h-4 w-4" />執行 Pipeline</>}
              </button>

              {(Object.keys(stepStatus).length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <StepBadge status={stepStatus.collect ?? 'idle'}
                    label={`蒐集${stepMsg.collect ? ` · ${stepMsg.collect}` : ''}`} />
                  <StepBadge status={stepStatus.filter ?? 'idle'}
                    label={`分析${stepMsg.filter ? ` · ${stepMsg.filter}` : ''}`} />
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
                  { label: '蒐集總數', value: orgs.length, color: 'text-gray-700' },
                  { label: '入選', value: selectedOrgs.length, color: 'text-green-600' },
                  { label: '淘汰', value: orgs.length - selectedOrgs.length, color: 'text-red-500' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl border text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* By-rule call panels */}
            {byRule.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">規則分組撥打</h3>
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
                            {conditionSummary(rule.condition)} · {matched.length} 家 · {phones.length} 支有效電話
                          </div>
                        </div>
                        {script ? (
                          <button type="button"
                            onClick={() => batchCall(rule.id, phones, script)}
                            disabled={isCalling || phones.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isCalling ? <><Loader2 className="h-3 w-3 animate-spin" />撥打中…</> : <><PhoneCall className="h-3 w-3" />撥打 {phones.length} 支</>}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 px-2">未指定腳本</span>
                        )}
                      </div>
                      {script && (
                        <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg">
                          腳本：{script.name}
                        </div>
                      )}
                      {result && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-green-600">✓ 成功 {result.ok}</span>
                          {result.fail > 0 && <span className="text-red-500">✗ 失敗 {result.fail}</span>}
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
                                : <div className="text-gray-300">無電話</div>
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
            {unmapped.length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
                  未分配（無匹配規則）{unmapped.length} 家
                </summary>
                <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
                  {unmapped.map(o => (
                    <div key={o.id} className="flex items-start gap-2 py-1 border-t first:border-0 text-[11px]">
                      <Users className="h-3 w-3 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{o.name}</div>
                        <div className="text-gray-400">
                          {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji} {CATEGORIES.find(c => c.id === o.aiCategory)?.label}
                          {o.phoneNormalized && ` · ${isMobile(o.phoneNormalized) ? '📱' : '☎️'} ${o.phoneNormalized}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Filtered-out orgs */}
            {orgs.filter(o => !o.selected).length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
                  淘汰組織 {orgs.filter(o => !o.selected).length} 家（點擊展開）
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
            {selectedOrgs.length > 0 && (
              <details className="border rounded-xl">
                <summary className="px-4 py-3 text-xs text-gray-600 font-medium cursor-pointer hover:bg-gray-50 select-none">
                  入選完整列表 {selectedOrgs.length} 家
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500">
                        <th className="px-3 py-2 text-left font-medium">組織</th>
                        <th className="px-3 py-2 text-left font-medium">分類</th>
                        <th className="px-3 py-2 text-left font-medium">電話</th>
                        <th className="px-3 py-2 text-left font-medium">規則</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrgs.map(o => {
                        const ruleId = orgRuleMap.get(o.id)
                        const ruleName = ruleId ? config.routingRules.find(r => r.id === ruleId)?.name : undefined
                        return (
                          <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium">{o.name}</div>
                              {o.address && <div className="text-gray-400 truncate max-w-[150px]">{o.address}</div>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji}{' '}
                              {CATEGORIES.find(c => c.id === o.aiCategory)?.label}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {o.phoneNormalized
                                ? <span className="text-green-600">{isMobile(o.phoneNormalized) ? '📱' : '☎️'} {o.phoneNormalized}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                              {ruleName ?? <span className="text-gray-300">未分配</span>}
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
        </div>
      </div>
    </div>
  )
}
