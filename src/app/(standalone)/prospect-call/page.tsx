'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search, Building2, MapPin, Phone, Zap, Play, Loader2,
  CheckCircle2, AlertCircle, XCircle, Plus, Trash2, ChevronDown, ChevronUp,
  Filter, Radio, Users, Map, Globe, Mic, Settings2, PhoneCall,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CollectSource = 'map' | 'facebook' | 'web'
type StepStatus = 'idle' | 'running' | 'done' | 'error'

interface Branch {
  id: string; name: string; address: string; phone?: string; lat?: number; lng?: number
}

interface VoiceScript {
  id: string; name: string; text: string; voiceId: string
}

interface CategoryMapping {
  category: string; scriptId: string
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
  categoryMappings: CategoryMapping[]
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
  categoryMappings: [],
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
  const [callingCategory, setCallingCategory] = useState<string | null>(null)
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

  // ── Category mapping ──────────────────────────────────────────────────────

  const setMapping = (category: string, scriptId: string) => {
    const rest = config.categoryMappings.filter(m => m.category !== category)
    setC('categoryMappings', scriptId ? [...rest, { category, scriptId }] : rest)
  }

  const getMappedScript = (category: string) => {
    const m = config.categoryMappings.find(x => x.category === category)
    return m ? config.voiceScripts.find(s => s.id === m.scriptId) : null
  }

  // ── Run pipeline ──────────────────────────────────────────────────────────

  const runPipeline = async () => {
    if (!config.keywords.trim()) { setError('請填寫搜尋關鍵字'); return }
    setError(''); setRunning(true); abortRef.current = false
    setOrgs([]); setCallResults({})
    setStepStatus({ collect: 'running', filter: 'idle', done: 'idle' })
    setStepMsg({})

    try {
      // Step 1: Collect
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

      // Step 2: Filter + distance + classify
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

  // ── Batch call by category ────────────────────────────────────────────────

  const batchCall = async (categoryId: string) => {
    const script = getMappedScript(categoryId)
    if (!script) return
    const phones = orgs
      .filter(o => o.selected && o.aiCategory === categoryId && o.phoneNormalized)
      .map(o => o.phoneNormalized!)
    if (phones.length === 0) return

    setCallingCategory(categoryId)
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
        [categoryId]: { ok: data.success ?? 0, fail: (data.total ?? 0) - (data.success ?? 0) },
      }))
    } catch (e) {
      setError(String(e))
    } finally {
      setCallingCategory(null)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const selectedOrgs = orgs.filter(o => o.selected)
  const byCategory = CATEGORIES.map(c => ({
    ...c,
    orgs: selectedOrgs.filter(o => o.aiCategory === c.id),
    script: getMappedScript(c.id),
  })).filter(c => c.orgs.length > 0)

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

            {/* Step 5: Category → Script mapping */}
            <Section title="Step 5 — 分類對應腳本" icon={Settings2}
              open={openSections.mapping} onToggle={() => toggleSection('mapping')}>
              <p className="text-xs text-gray-500">為每種組織類別指定要使用的語音腳本</p>
              <div className="space-y-2">
                {CATEGORIES.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-sm w-24 flex-shrink-0">{c.emoji} {c.label}</span>
                    <select
                      value={config.categoryMappings.find(m => m.category === c.id)?.scriptId ?? ''}
                      onChange={e => setMapping(c.id, e.target.value)}
                      className="flex-1 h-8 px-2 rounded-lg border text-xs outline-none focus:ring-2 bg-white">
                      <option value="">— 不撥打 —</option>
                      {config.voiceScripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ))}
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

              {/* Steps */}
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

            {/* By-category call panels */}
            {byCategory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">分類撥打</h3>
                {byCategory.map(c => {
                  const phones = c.orgs.filter(o => o.phoneNormalized)
                  const result = callResults[c.id]
                  const isCalling = callingCategory === c.id
                  return (
                    <div key={c.id} className="p-4 rounded-xl border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{c.emoji}</span>
                          <div>
                            <div className="text-sm font-semibold">{c.label}</div>
                            <div className="text-[10px] text-gray-400">{c.orgs.length} 家入選 · {phones.length} 支有效電話</div>
                          </div>
                        </div>
                        {c.script ? (
                          <button type="button" onClick={() => batchCall(c.id)}
                            disabled={isCalling || phones.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}>
                            {isCalling ? <><Loader2 className="h-3 w-3 animate-spin" />撥打中…</> : <><PhoneCall className="h-3 w-3" />撥打 {phones.length} 支</>}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 px-2">未指定腳本</span>
                        )}
                      </div>
                      {c.script && (
                        <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg">
                          腳本：{c.script.name}
                        </div>
                      )}
                      {result && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-green-600">✓ 成功 {result.ok}</span>
                          {result.fail > 0 && <span className="text-red-500">✗ 失敗 {result.fail}</span>}
                        </div>
                      )}
                      {/* Org list */}
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {c.orgs.map(o => (
                          <div key={o.id} className="flex items-start gap-2 text-[11px] py-1 border-t first:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{o.name}</div>
                              {o.address && <div className="text-gray-400 truncate">{o.address}</div>}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {o.phoneNormalized
                                ? <div className="text-green-600">{o.phoneNormalized}</div>
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

            {/* Filtered-out orgs (collapsed) */}
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

            {/* All orgs table (selected) */}
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
                        <th className="px-3 py-2 text-left font-medium">最近門市</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrgs.map(o => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium">{o.name}</div>
                            {o.address && <div className="text-gray-400 truncate max-w-[150px]">{o.address}</div>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {CATEGORIES.find(c => c.id === o.aiCategory)?.emoji}{' '}
                            {CATEGORIES.find(c => c.id === o.aiCategory)?.label}
                          </td>
                          <td className="px-3 py-2 text-green-600 whitespace-nowrap">
                            {o.phoneNormalized || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                            {o.nearestBranch
                              ? `${o.nearestBranch} ${o.nearestBranchDistance}km`
                              : '—'}
                          </td>
                        </tr>
                      ))}
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
