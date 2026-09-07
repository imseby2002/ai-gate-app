'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  Target,
  Code,
  Users,
  Sparkles,
  Send,
  FileText,
  UserCheck,
  CheckCircle2,
  Maximize2,
  Minimize2,
  GraduationCap,
} from 'lucide-react'
import { ExpertSelector } from '@/components/experts/ExpertSelector'
import { cn } from '@/lib/utils/cn'
import {
  DEFAULT_SEATS,
  DEFAULT_MODERATOR,
  MODERATOR_MODELS,
  SYNTHESIS_STYLES,
  VERBOSITY_OPTIONS,
  formatModelDisplayName,
  DOMAIN_PRESETS,
  type RoundtableDomain,
  type SynthesisStyle,
  type VerbosityMode,
} from '@/lib/ai/roundtable'

interface SeatBlock {
  round: number
  name: string
  model?: string
  stance?: string
  content: string
  error?: string
}

interface SessionSummary {
  id: string
  instruction: string
  created_at: string
}

export interface CustomSeatConfig {
  name: string
  model?: string
  stance: string
  philosophy: string
  attackTriggers: string
}

export const AVAILABLE_SEAT_MODELS = [
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude 3.7 Sonnet (Anthropic 原廠)' },
  { id: 'openai/gpt-4o', label: 'GPT-4o (OpenAI 原廠)' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google 原廠)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google 原廠)' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (DeepSeek 原廠)' },
  { id: 'cliproxy/gemini-2.5-flash', label: '⚡ CLIProxy · Gemini 2.5 Flash (免費代理)' },
  { id: 'cliproxy/gemini-2.5-pro', label: '⚡ CLIProxy · Gemini 2.5 Pro (免費代理)' },
  { id: 'cliproxy/claude-sonnet-4-6', label: '⚡ CLIProxy · Claude Sonnet (免費代理)' },
  { id: 'freellm/llama-3.3-70b', label: '⚡ FreeLLM · Llama 3.3 70B (免費代理)' },
  { id: 'freellm/auto', label: '⚡ FreeLLM · Auto 自動多平台備援 (免費代理)' },
]

export const ROLE_PRESETS = [
  {
    label: '💎 免費代理智囊團 (CLIProxy + FreeLLM 零成本)',
    description: '使用 CLIProxy (Gemini) 與 FreeLLM (Llama) 免費模型激辯',
    seats: [
      {
        name: '開源架構 (FreeLLM)',
        model: 'freellm/llama-3.3-70b',
        stance: '開源生態與工程落實',
        philosophy: '以全球頂尖開源大模型思維，重視開放架構、性價比與工程可行性。',
        attackTriggers: '抨擊閉源壟斷與高昂授權成本、痛批華而不實的商業噱頭。',
      },
      {
        name: '敏捷先鋒 (CLIProxy)',
        model: 'cliproxy/gemini-2.5-flash',
        stance: '極速破局與產品迭代',
        philosophy: '天下武功唯快不破。搶先驗證 MVP 與市場反饋，拒絕沉睡在過度完美的分析中。',
        attackTriggers: '砲轟過度保守分析癱瘓決策、質疑錯失關鍵市場先機。',
      },
      {
        name: '審計風控 (CLIProxy)',
        model: 'cliproxy/gemini-2.5-pro',
        stance: '極限風控與邊界審計',
        philosophy: '以極致嚴謹的長上下文推理，穿透隱藏風險與數據漏洞，守護資產安全。',
        attackTriggers: '質疑未經壓力測試的樂觀預期、砲轟缺乏數據支撐的冒進。',
      },
    ],
  },
  {
    label: '🏦 頂級投行激辯 (大摩 vs 先鋒 vs 小摩)',
    description: '華爾街主流機構視角碰撞',
    seats: [
      { name: '摩根大通 (JPMorgan)', stance: '宏觀流動性與利率週期觀點', philosophy: '緊盯美聯儲政策利率路徑、投行承銷景氣與全球流動性收緊風險。', attackTriggers: '攻擊忽視資本成本上升、抨擊估值過高難以為繼。' },
      { name: '先鋒集團 (Vanguard)', stance: '長期被動配置與安全邊際', philosophy: '極致注重費率成本、長期資產配置、穩健被動分散風險。', attackTriggers: '抨擊主動擇時盲動、質疑高換手率的高額代價。' },
      { name: '摩根士丹利 (Morgan Stanley)', stance: '產業護城河與目標價重估', philosophy: '深度挖掘產業基本面變化、結構性市佔率移轉與獲利修正。', attackTriggers: '質疑增長故事缺乏實質營收訂單支撐、挑剔獲利質量。' },
    ],
  },
  {
    label: '💼 企業高管交鋒 (成長長 vs 財務長 vs 技術長)',
    description: 'C-Suite 經營管理視角',
    seats: [
      { name: '成長長 (CGO)', stance: '激進擴張與市佔率優先', philosophy: '唯快不破。搶佔市場規模與用戶心智是第一優先，規模擴大後利潤自然隨之而來。', attackTriggers: '攻擊保守風控阻礙業務擴展、痛批錯失先發市場紅利。' },
      { name: '財務長 (CFO)', stance: '現金流安全邊際與成本嚴控', philosophy: '活下去才能贏。嚴格控制燒錢率、確保自由現金流與投資回報率 (ROI)。', attackTriggers: '砲轟畫大餅不顧財務崩潰風險、嚴防現金流斷裂。' },
      { name: '技術長 (CTO)', stance: '技術架構壁壘與研發交付可行性', philosophy: '工程紀律與架構護城河。所有的商業願景必須有扎實的技術深度與工程可行性。', attackTriggers: '攻擊不懂技術硬傷瞎指揮、質疑交付時程與架構擴展性。' },
    ],
  },
  {
    label: '🚀 創投與對沖機構 (矽谷 VC vs 價值基金 vs 做空機構)',
    description: '資本市場不同風格激進碰撞',
    seats: [
      { name: '矽谷風投 (VC)', stance: '指數級想像空間與網路效應', philosophy: '尋找潛在 100 倍回報。只要天花板夠高、技術範式轉移明確，就值得承擔高失敗率。', attackTriggers: '嘲笑線性思維無法理解非線性爆發、攻擊過早自我設限。' },
      { name: '價值基金 (Value Fund)', stance: '穩健股息與本益比安全防守', philosophy: '以合理價格買入卓越公司。重視資產負債表強韌度與股息安全。', attackTriggers: '抨擊泡沫幻覺與沒有護城河的偽創新、嚴防本金永久性損失。' },
      { name: '做空機構 (Short Seller)', stance: '深度質疑財報漏洞與商業死角', philosophy: '假設一切都在撒謊。以最嚴苛的審計與偵探視角，尋找財報美化與商業模式漏洞。', attackTriggers: '抓取隱瞞的負債與庫存積壓、拆穿過度美化的成長神話。' },
    ],
  },
  {
    label: '🎓 大學教授與學術智庫 (理論真理 vs 實證產學 vs 倫理治理)',
    description: '大學校務治理、科研立項與課堂深度思辨',
    seats: [
      {
        name: '理論真理派 (教授A)',
        stance: '學術基石 · 理論真理 (Epistemic Truth)',
        philosophy: '大學是追求真理與原創思想的殿堂。沒有深刻的理論根基與獨立批判思維，任何熱門技術或政策都只是泡沫。',
        attackTriggers: '砲轟他人迎合市場短視近利、出賣學術靈魂；抨擊行政官僚指標主義扼殺純粹思想原創性。',
      },
      {
        name: '實證創新派 (教授B)',
        stance: '經世致用 · 實證創新 (Pragmatic Utility)',
        philosophy: '學術必須解決真實世界難題。無法落地驗證、不能讓學生在就業市場脫穎而出的理論，只是象牙塔裡的自我陶醉。',
        attackTriggers: '砲轟他人自命清高、不知民間疾苦的玄學空談；痛批學校行政流程拖沓喪失時代先機。',
      },
      {
        name: '倫理治理派 (教授C)',
        stance: '倫理法治 · 永續治理 (Institutional Governance)',
        philosophy: '守住底線才能長青。再崇高的理想或突破，一旦觸犯學術倫理紅線、違反法規或導致少子化退場破產，一切歸零。',
        attackTriggers: '抨擊他人忽視少子化生源雪崩與財務現實；痛批為求速度踐踏倫理規範，導致百年校譽毀於一旦。',
      },
    ],
  },
]

const DOMAIN_OPTIONS: { id: RoundtableDomain; label: string; icon: typeof TrendingUp }[] = [
  { id: 'auto', label: '智慧自動', icon: Sparkles },
  { id: 'academic', label: '大學學術', icon: GraduationCap },
  { id: 'finance', label: '投資金融', icon: TrendingUp },
  { id: 'marketing', label: '行銷增長', icon: Target },
  { id: 'tech', label: '技術架構', icon: Code },
  { id: 'hr', label: '組織人才', icon: Users },
]

const DEFAULT_SEAT_NAMES = ['員工A', '員工B', '員工C']

export default function RoundtablePage() {
  const [instruction, setInstruction] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<RoundtableDomain>('auto')
  const [detectedDomainLabel, setDetectedDomainLabel] = useState('')
  const [detectedStances, setDetectedStances] = useState<{ name: string; title: string }[]>([])
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState('')

  // 會前事實簡報
  const [factBriefing, setFactBriefing] = useState('')
  const [showFactBriefing, setShowFactBriefing] = useState(true)

  // 研議發言記錄
  const [blocks, setBlocks] = useState<SeatBlock[]>([])
  const [report, setReport] = useState('')

  // 會議狀態與老闆指揮台
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [waitingBoss, setWaitingBoss] = useState(false)
  const [bossInput, setBossInput] = useState('')
  const [bossAction, setBossAction] = useState<'continue_all' | 'call_on' | 'synthesize'>('continue_all')
  const [targetSeat, setTargetSeat] = useState('員工A')
  const [crossExamine, setCrossExamine] = useState(true)

  // 專家知識設定
  const [showExpertConfig, setShowExpertConfig] = useState(false)
  const [seatExperts, setSeatExperts] = useState<Record<number, string[]>>({ 0: [], 1: [], 2: [] })

  // 自訂角色觀點設定
  const [showRoleConfig, setShowRoleConfig] = useState(false)
  const [customSeats, setCustomSeats] = useState<CustomSeatConfig[]>([
    { name: '員工A', model: DEFAULT_SEATS[0].model, stance: '', philosophy: '', attackTriggers: '' },
    { name: '員工B', model: DEFAULT_SEATS[1].model, stance: '', philosophy: '', attackTriggers: '' },
    { name: '員工C', model: DEFAULT_SEATS[2].model, stance: '', philosophy: '', attackTriggers: '' },
  ])

  const isAnySeatCustomized = customSeats.some(
    (s, idx) => s.name.trim() !== DEFAULT_SEAT_NAMES[idx] || s.stance.trim() !== '' || s.philosophy.trim() !== ''
  )

  const updateCustomSeat = (idx: number, field: keyof CustomSeatConfig, value: string) => {
    setCustomSeats(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const applyPreset = (preset: typeof ROLE_PRESETS[0]) => {
    setCustomSeats(preset.seats.map((s, idx) => ({
      name: s.name,
      model: (s as { model?: string }).model ?? DEFAULT_SEATS[idx].model,
      stance: s.stance,
      philosophy: s.philosophy,
      attackTriggers: s.attackTriggers,
    })))
    setTargetSeat(preset.seats[0].name)
    setShowRoleConfig(true)
  }

  const resetCustomSeats = () => {
    setCustomSeats([
      { name: '員工A', model: DEFAULT_SEATS[0].model, stance: '', philosophy: '', attackTriggers: '' },
      { name: '員工B', model: DEFAULT_SEATS[1].model, stance: '', philosophy: '', attackTriggers: '' },
      { name: '員工C', model: DEFAULT_SEATS[2].model, stance: '', philosophy: '', attackTriggers: '' },
    ])
    setTargetSeat('員工A')
  }

  // 首席幕僚長（總結者）設定
  const [moderatorModel, setModeratorModel] = useState<string>(DEFAULT_MODERATOR.model)
  const [synthesisStyle, setSynthesisStyle] = useState<SynthesisStyle>('default')
  // 研議篇幅檔位設定
  const [verbosity, setVerbosity] = useState<VerbosityMode>('standard_300')

  // 延續討論暫存的前次決策報告
  const [previousReport, setPreviousReport] = useState('')
  const [showPrevReport, setShowPrevReport] = useState(false)

  // 歷史紀錄
  const [history, setHistory] = useState<SessionSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)

  // 版面極大化與側邊欄動態收合聯動
  const [isWideView, setIsWideView] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = (collapse?: boolean) => {
    const next = collapse !== undefined ? collapse : !sidebarCollapsed
    setSidebarCollapsed(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sidebar:collapse', { detail: { collapsed: next } }))
    }
  }

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchHistory()
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const sessionFromUrl = urlParams.get('session')
      if (sessionFromUrl) {
        loadSession(sessionFromUrl)
      }
    } catch {
      // ignore
    }
  }, [])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/roundtable/sessions')
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.sessions ?? [])
    } catch {
      // ignore
    }
  }

  function startNewMeeting() {
    setViewingId(null)
    setSessionId(null)
    setBlocks([])
    setFactBriefing('')
    setReport('')
    setPreviousReport('')
    setInstruction('')
    setWaitingBoss(false)
    setBossInput('')
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('session')
      window.history.replaceState(null, '', url.toString())
    } catch {
      // ignore
    }
  }

  async function loadSession(id: string) {
    if (loadingSession) return
    setLoadingSession(true)
    try {
      const res = await fetch(`/api/roundtable/sessions/${id}`)
      if (!res.ok) return
      const { session } = await res.json()
      const seatModelByName = new Map<string, string>(
        (session.seats ?? []).map((s: { name: string; model: string }) => [s.name, s.model])
      )
      setInstruction(session.instruction)
      setFactBriefing(session.fact_briefing ?? '')
      if (session.domain) {
        setDomain(session.domain)
        const preset = DOMAIN_PRESETS[session.domain as RoundtableDomain] ?? DOMAIN_PRESETS.auto
        setDetectedDomainLabel(preset.label)
      }
      if (session.seats?.length) {
        setCustomSeats(
          session.seats.map((s: { name?: string; model?: string; stance?: string; customPhilosophy?: string; customAttackTriggers?: string }, i: number) => ({
            name: s.name || DEFAULT_SEAT_NAMES[i],
            model: s.model || DEFAULT_SEATS[i].model,
            stance: s.stance || '',
            philosophy: s.customPhilosophy || '',
            attackTriggers: s.customAttackTriggers || '',
          }))
        )
        setTargetSeat(session.seats[0]?.name || DEFAULT_SEAT_NAMES[0])
      }
      const transcriptList = (session.transcript ?? []) as Array<{ round: number; name: string; content: string; stance?: string }>
      const moderatorBlock = transcriptList.find(t => t.name === '首席幕僚長' || t.round === 99)
      setBlocks(
        transcriptList
          .filter(t => t.name !== '首席幕僚長' && t.round !== 99)
          .map(t => ({
            round: t.round,
            name: t.name,
            model: seatModelByName.get(t.name),
            stance: t.stance,
            content: t.content,
          }))
      )
      setReport(session.report || moderatorBlock?.content || '')
      setPreviousReport('')
      setPhase('')
      setSessionId(session.id)
      setViewingId(session.id)
      // 核心：任何過往紀錄載入後，老闆指揮台一律就緒，可隨時在下方接續同件事情討論！
      setWaitingBoss(true)
      setShowHistory(false)
      // 載入紀錄時自動極大化
      toggleSidebar(true)
      setIsWideView(true)
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('session', session.id)
        window.history.replaceState(null, '', url.toString())
      } catch {
        // ignore
      }
    } finally {
      setLoadingSession(false)
    }
  }

  function setSeatExpert(idx: number, ids: string[]) {
    setSeatExperts(prev => ({ ...prev, [idx]: ids }))
  }

  // ── 發起新會議 ────────────────────────────────────────────────────────────

  async function start() {
    if (!instruction.trim() || running) return

    // 開始會議時，自動將左側功能表縮小，盡量佔滿整個螢幕，讓三個員工視窗極大化
    toggleSidebar(true)
    setIsWideView(true)

    setRunning(true)
    setBlocks([])
    setFactBriefing('')
    setReport('')
    setPreviousReport('')
    setPhase('')
    setViewingId(null)
    setSessionId(null)
    setWaitingBoss(false)
    setBossInput('')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const seatExpertIds = DEFAULT_SEAT_NAMES.map((_, i) => seatExperts[i]?.[0] ?? null)
    const hasExperts = seatExpertIds.some(Boolean)

    const finalSeatsToSend = customSeats.map((cs, i) => {
      const defaultSeat = DEFAULT_SEATS[i]
      return {
        name: cs.name.trim() || defaultSeat.name,
        model: cs.model || defaultSeat.model,
        role: defaultSeat.role,
        stance: cs.stance.trim() || undefined,
        customPhilosophy: cs.philosophy.trim() || undefined,
        customAttackTriggers: cs.attackTriggers.trim() || undefined,
        expertId: seatExperts[i]?.[0] || undefined,
      }
    })

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          domain: selectedDomain,
          seats: finalSeatsToSend,
          seatExpertIds: hasExperts ? seatExpertIds : undefined,
          interactive: true,
          moderator: {
            name: '首席幕僚長',
            model: moderatorModel,
            role: DEFAULT_MODERATOR.role,
          },
          synthesisStyle,
          verbosity,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'failed' }))
        setReport(`⚠️ ${err.error ?? '請求失敗'}`)
        setRunning(false)
        return
      }

      await readStream(res.body)
    } catch {
      // aborted
    } finally {
      setRunning(false)
      fetchHistory()
    }
  }

  // ── 老闆介入發出下一步指令 (Step) ──────────────────────────────────────────

  async function submitBossStep(actionOverride?: 'continue_all' | 'call_on' | 'synthesize') {
    if (!sessionId || running) return
    const currentAction = actionOverride ?? bossAction
    if (currentAction !== 'synthesize' && !bossInput.trim()) return

    setRunning(true)
    setWaitingBoss(false)

    // 若是老闆發言，先在前端記錄一條老闆發言
    if (currentAction !== 'synthesize' && bossInput.trim()) {
      const currentMaxRound = blocks.reduce((max, b) => Math.max(max, Number(b.round) || 1), 2)
      setBlocks(prev => [
        ...prev,
        {
          round: currentMaxRound + 1,
          name: '老闆指令',
          stance: currentAction === 'call_on' ? `點名 ${targetSeat}` : '全體深化',
          content: bossInput.trim(),
        },
      ])
      // 若已有前次決策報告，暫存至 previousReport，讓畫面聚焦最新辯論
      if (report) {
        setPreviousReport(report)
        setReport('')
      }
    }

    const currentInput = bossInput.trim()
    setBossInput('')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/roundtable/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: currentAction,
          bossGuidance: currentInput,
          targetSeat,
          crossExamine,
          moderatorModel,
          synthesisStyle,
          verbosity,
          seats: customSeats.map((cs, i) => ({
            name: cs.name.trim() || DEFAULT_SEAT_NAMES[i],
            model: cs.model || DEFAULT_SEATS[i].model,
            role: DEFAULT_SEATS[i].role,
            stance: cs.stance.trim() || undefined,
            customPhilosophy: cs.philosophy.trim() || undefined,
            customAttackTriggers: cs.attackTriggers.trim() || undefined,
            expertId: seatExperts[i]?.[0] ?? null,
          })),
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'failed' }))
        setReport(`⚠️ ${err.error ?? '推進失敗'}`)
        setRunning(false)
        return
      }

      await readStream(res.body)
    } catch {
      // aborted
    } finally {
      setRunning(false)
      fetchHistory()
    }
  }

  // ── SSE 串流解析公用函式 ──────────────────────────────────────────────────

  async function readStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue
        const e = JSON.parse(payload)

        if (e.type === 'session-created') {
          setSessionId(e.sessionId)
        } else if (e.type === 'domain-detected') {
          setDetectedDomainLabel(e.label)
          setDetectedStances(e.stances ?? [])
        } else if (e.type === 'phase') {
          setPhase(e.label)
        } else if (e.type === 'briefing-delta') {
          setFactBriefing(prev => prev + e.content)
        } else if (e.type === 'briefing-end') {
          setFactBriefing(e.content)
        } else if (e.type === 'seat-start') {
          if (e.name === '首席幕僚長' || e.round === 99) {
            // 幕僚長總結：直接開啟全寬決策報告卡片串流，絕不擠入 A 席位欄位
            setReport('')
            setPreviousReport('')
            setPhase('👑 首席幕僚長正在出具高層決策報告…')
          } else {
            setBlocks(prev => [
              ...prev,
              { round: e.round, name: e.name, model: e.model, stance: e.stance, content: '' },
            ])
          }
        } else if (e.type === 'delta') {
          if (e.name === '首席幕僚長' || e.round === 99) {
            // 幕僚長總結：內容直接即時串流至全寬決策報告中
            setReport(prev => prev + e.content)
          } else {
            setBlocks(prev => {
              const next = [...prev]
              const idx = next.findLastIndex(b => b.round === e.round && b.name === e.name)
              if (idx >= 0) next[idx] = { ...next[idx], content: next[idx].content + e.content }
              return next
            })
          }
        } else if (e.type === 'seat-end') {
          if (e.name === '首席幕僚長' || e.round === 99) {
            if (e.error) {
              setReport(prev => (prev ? `${prev}\n⚠️ 幕僚長總結失敗：${e.error}` : `⚠️ 幕僚長總結失敗：${e.error}`))
            }
          } else if (e.error) {
            setBlocks(prev => {
              const next = [...prev]
              const idx = next.findLastIndex(b => (e.round ? b.round === e.round : true) && b.name === e.name)
              if (idx >= 0) next[idx] = { ...next[idx], error: e.error }
              return next
            })
          }
        } else if (e.type === 'boss-instruction') {
          setBlocks(prev => {
            if (prev.some(b => b.round === e.round && b.name === '老闆指令')) return prev
            return [
              ...prev,
              {
                round: e.round,
                name: '老闆指令',
                stance: e.targetSeat ? `點名 ${e.targetSeat}` : '全體深化',
                content: e.content,
              },
            ]
          })
        } else if (e.type === 'waiting_boss') {
          setWaitingBoss(true)
          setPhase('⏸️ 會議暫停 · 等待老闆裁示')
        } else if (e.type === 'report') {
          setReport(e.content)
          setPreviousReport('')
          setWaitingBoss(true) // 產出報告後，老闆指揮台依然常駐，方便隨時再追問深化！
        } else if (e.type === 'error') {
          if (e.name === 'system') {
            setReport(prev => (prev ? `${prev}\n⚠️ ${e.error}` : `⚠️ ${e.error}`))
          } else {
            setBlocks(prev => {
              const next = [...prev]
              const idx = next.findLastIndex(b => (e.round ? b.round === e.round : true) && b.name === e.name)
              if (idx >= 0) next[idx] = { ...next[idx], error: e.error }
              return next
            })
          }
        }
      }
    }
  }

  function stop() {
    abortRef.current?.abort()
    setRunning(false)
  }

  // 計算輪次列表 (過濾出所有大於 0 的輪次，且排除幕僚長專屬輪次 99 與非標準席位發言)
  const roundNumbers = [...new Set(blocks.filter(b => b.round !== 99 && b.name !== '首席幕僚長').map(b => b.round))].sort((a, b) => a - b)
  const completedRound = blocks
    .filter(b => b.round !== 99 && b.name !== '首席幕僚長')
    .reduce((max, b) => Math.max(max, Number(b.round) || 1), 2)
  const nextDiscussRound = completedRound + 1
  const nextRebutRound = completedRound + 2

  return (
    <div className="h-full overflow-y-auto">
      <div
        className={cn(
          "mx-auto space-y-6 transition-all duration-300 ease-in-out",
          isWideView && (blocks.length > 0 || running || report)
            ? "max-w-[1800px] w-full px-4 md:px-8 py-6"
            : "max-w-4xl px-4 md:px-6 py-6"
        )}
      >
        {/* 標題與操作按鈕 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>🏛️ AI 智慧圓桌會議 2.0</span>
              <Badge variant="outline" className="text-xs">Interactive Virtual Boardroom</Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              客觀事實查核先行，三大戰略學派平行激辯。老闆全程掌握主持權，隨時追問挑刺、一鍵收斂決策報告。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !isWideView
                setIsWideView(next)
                toggleSidebar(next)
              }}
              title={isWideView ? '收合為標準寬度' : '切換為寬螢幕極大化'}
            >
              {isWideView ? <Minimize2 className="mr-1.5 h-4 w-4" /> : <Maximize2 className="mr-1.5 h-4 w-4" />}
              {isWideView ? '極大化視窗' : '標準視窗'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(v => !v)}>
              <History className="mr-1.5 h-4 w-4" />
              歷史紀錄
            </Button>
          </div>
        </div>

        {/* 歷史紀錄抽屜 */}
        {showHistory && (
          <Card className="p-4 space-y-2">
            <p className="text-sm font-medium">過往會議紀錄</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">還沒有任何紀錄</p>
            ) : (
              <div className="divide-y max-h-60 overflow-y-auto">
                {history.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => loadSession(s.id)}
                    disabled={loadingSession}
                    className="w-full py-2 text-left hover:bg-muted/30 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm line-clamp-1">{s.instruction}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString('zh-TW')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* 檢視歷史紀錄模式通知 */}
        {viewingId && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex-wrap shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-background text-primary border-primary/40 font-semibold px-2.5 py-0.5">
                📂 接續議題研議 · 第 {completedRound} 輪
              </Badge>
              <span className="text-xs sm:text-sm font-medium text-foreground">
                正在延續「{instruction}」，可直接於下方【老闆指揮台】追加指示繼續推演
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background shadow-xs hover:bg-primary/10"
                onClick={() => {
                  const consoleEl = document.getElementById('boss-console')
                  if (consoleEl) {
                    consoleEl.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
              >
                直達老闆指揮台 ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={startNewMeeting}
              >
                開始新的會議
              </Button>
            </div>
          </div>
        )}

        {/* 議題輸入與設定卡片 */}
        <Card className="space-y-4 p-5">
          {/* 領域快捷膠囊 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">領域情境：</span>
            {DOMAIN_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isSelected = selectedDomain === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedDomain(opt.id)}
                  disabled={running}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          <Textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="老闆，請下指令… (例如：比較 Palo Alto (PANW) 與 Fortinet (FTNT) 的營收體質、自由現金流與估值風險，給予明確投資配置建議)"
            rows={3}
            disabled={running}
          />

          {/* 自訂合夥人角色與視角觀點 (選填) */}
          <div className="border rounded-lg overflow-hidden bg-card/50">
            <button
              type="button"
              onClick={() => setShowRoleConfig(v => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  🎭 自訂合夥人角色與視角觀點 (選填)
                </span>
                {isAnySeatCustomized ? (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-primary/15 text-primary border-primary/20 font-medium">
                    ✨ 已啟用自訂觀點 ({customSeats.filter(s => s.stance.trim() || (s.name.trim() && !DEFAULT_SEAT_NAMES.includes(s.name.trim()))).length} 席)
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    (可設定摩根大通、先鋒、大摩、或企業高管等多元視角)
                  </span>
                )}
              </div>
              {showRoleConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showRoleConfig && (
              <div className="border-t p-3.5 space-y-3.5 bg-muted/10">
                {/* 快捷範本按鈕 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">⚡ 一鍵套用經典對立組合：</span>
                    {isAnySeatCustomized && (
                      <button
                        type="button"
                        onClick={resetCustomSeats}
                        className="text-[11px] text-primary hover:underline"
                      >
                        🔄 恢復領域預設學派
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="text-xs px-2.5 py-1 rounded-md border bg-background hover:bg-muted/60 transition-colors text-left"
                        title={preset.description}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 三席位編輯卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {customSeats.map((seat, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2.5 bg-background text-xs shadow-xs">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <Badge variant="outline" className="font-semibold text-xs">
                          席位 {i === 0 ? 'A' : i === 1 ? 'B' : 'C'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatModelDisplayName(seat.model || DEFAULT_SEATS[i].model)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">驅動模型</label>
                        <select
                          value={seat.model || DEFAULT_SEATS[i].model}
                          onChange={e => updateCustomSeat(i, 'model', e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring font-medium"
                        >
                          {AVAILABLE_SEAT_MODELS.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">席位名稱 / 代表機構</label>
                        <input
                          type="text"
                          value={seat.name}
                          onChange={e => updateCustomSeat(i, 'name', e.target.value)}
                          placeholder={DEFAULT_SEAT_NAMES[i]}
                          className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">戰略學派 / 視角觀點</label>
                        <input
                          type="text"
                          value={seat.stance}
                          onChange={e => updateCustomSeat(i, 'stance', e.target.value)}
                          placeholder={`預設：${DOMAIN_PRESETS[selectedDomain]?.stances[i]?.title || '學派立場'}`}
                          className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">底層哲學 / 關注指標 (選填)</label>
                        <input
                          type="text"
                          value={seat.philosophy}
                          onChange={e => updateCustomSeat(i, 'philosophy', e.target.value)}
                          placeholder="例如：重視流動性與資本成本"
                          className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">挑刺開砲觸發點 (選填)</label>
                        <input
                          type="text"
                          value={seat.attackTriggers}
                          onChange={e => updateCustomSeat(i, 'attackTriggers', e.target.value)}
                          placeholder="例如：抨擊忽視資本成本上升"
                          className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 👑 董事會首席幕僚長（決策收斂官）設定 */}
                <div className="rounded-lg border p-3.5 bg-background/90 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        👑 董事會首席幕僚長（決策收斂官）
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        主筆高層白皮書
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      當研議完成時，由首席幕僚長綜觀全場分歧、出具決策白皮書
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">主筆幕僚長旗艦模型</label>
                      <select
                        value={moderatorModel}
                        onChange={e => setModeratorModel(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring font-medium"
                      >
                        {MODERATOR_MODELS.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} —— {m.badge}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">決策收斂風格 (選填)</label>
                      <select
                        value={synthesisStyle}
                        onChange={e => setSynthesisStyle(e.target.value as SynthesisStyle)}
                        className="w-full text-xs px-2.5 py-1.5 border rounded-md bg-background focus:outline-hidden focus:ring-1 focus:ring-ring font-medium"
                      >
                        {SYNTHESIS_STYLES.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 專家知識設定（選填） */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExpertConfig(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <span>導入專屬知識庫 (選填)</span>
              {showExpertConfig ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showExpertConfig && (
              <div className="border-t divide-y">
                {DEFAULT_SEAT_NAMES.map((name, i) => {
                  const displayName = customSeats[i]?.name.trim() || name
                  return (
                    <div key={name} className="p-2.5 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{displayName} 專屬知識庫</p>
                      <ExpertSelector
                        selectedIds={seatExperts[i] ?? []}
                        onChange={ids => setSeatExpert(i, ids)}
                        single
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 發言篇幅檔位切換 (選項2：四檔字數切換) */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-lg border bg-muted/20 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                📏 研議篇幅檔位：
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {VERBOSITY_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVerbosity(opt.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all border',
                      verbosity === opt.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    )}
                    title={opt.description}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {VERBOSITY_OPTIONS.find(v => v.id === verbosity)?.targetWords}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={start} disabled={running || !instruction.trim()}>
                {running ? '會議進行中…' : (viewingId ? '以新議題開會' : '召開圓桌會議')}
              </Button>
              {viewingId && !running && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const consoleEl = document.getElementById('boss-console')
                    if (consoleEl) {
                      consoleEl.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  接續本議題研議 ↓
                </Button>
              )}
              {running && (
                <Button variant="outline" onClick={stop}>
                  中斷停止
                </Button>
              )}
            </div>
            {phase && (
              <Badge variant="secondary" className="px-3 py-1 font-normal text-xs animate-pulse">
                {phase}
              </Badge>
            )}
          </div>

          {/* 戰略學派提示條 */}
          {detectedStances.length > 0 && (
            <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground flex flex-wrap items-center gap-2 border">
              <span className="font-semibold text-foreground">
                {detectedDomainLabel ? `【${detectedDomainLabel}】` : '【已辨識】'} 與會合夥人戰略立場：
              </span>
              {detectedStances.map((s, idx) => (
                <Badge key={idx} variant="outline" className="bg-background text-xs">
                  {s.name}：{s.title}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* 階段 0：資料專員 · 客觀事實簡報 */}
        {factBriefing && (
          <Card className="border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/10 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  📊 資料專員 · 會前客觀事實簡報 (Fact Sheet)
                </Badge>
                <Badge variant="outline" className="text-xs bg-background text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 font-normal">
                  🌐 Gemini 2.5 Flash & Perplexity 即時聯網查證引擎
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowFactBriefing(v => !v)}
              >
                {showFactBriefing ? '收合簡報' : '展開簡報'}
              </Button>
            </div>
            {showFactBriefing && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed border-t pt-3 max-h-[500px] overflow-y-auto font-mono text-xs bg-background/50 p-3 rounded mt-2 border">
                {factBriefing}
              </div>
            )}
          </Card>
        )}

        {/* 逐輪發言內容呈現 */}
        {roundNumbers.map(roundNum => {
          const items = blocks.filter(b => b.round === roundNum)
          const bossMsg = items.find(b => b.name === '老闆指令')
          const seatItems = items.filter(b => b.name !== '老闆指令' && b.name !== '首席幕僚長' && b.round !== 99)

          return (
            <div key={roundNum} className="space-y-3">
              {/* 老闆指令專屬橫幅 */}
              {bossMsg && (
                <div className="rounded-lg border-2 border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-600 hover:bg-amber-700 text-white">👑 老闆介入裁示</Badge>
                    {bossMsg.stance && <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">({bossMsg.stance})</span>}
                  </div>
                  <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{bossMsg.content}</p>
                </div>
              )}

              {/* 本輪各合夥人發言 (多卡片平行並列/縱向) */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  {roundNum === 1 ? (
                    <>
                      <span className="text-primary font-bold">第一輪</span>
                      <span>·</span>
                      <span>獨立研議 (論述輪 · 平行)</span>
                    </>
                  ) : roundNum === 2 ? (
                    <>
                      <span className="text-amber-500 font-bold">第二輪</span>
                      <span>·</span>
                      <span>針鋒相對 (互評挑刺輪 · 平行)</span>
                    </>
                  ) : roundNum % 2 === 1 ? (
                    <>
                      <span className="text-primary font-bold">第 {roundNum} 輪</span>
                      <span>·</span>
                      <span>深化論述 (針對老闆最新指示)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-500 font-bold">第 {roundNum} 輪</span>
                      <span>·</span>
                      <span>針鋒相對 (針對新方案互評挑刺)</span>
                    </>
                  )}
                </h2>
              </div>

              <div className={cn(
                "grid gap-4",
                seatItems.length === 1
                  ? "grid-cols-1"
                  : seatItems.length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-3"
              )}>
                {seatItems.map((b, i) => (
                  <Card key={`${roundNum}-${b.name}-${i}`} className="p-5 space-y-3 flex flex-col justify-between border shadow-sm hover:shadow-md transition-shadow bg-card/95">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5 pb-2 border-b border-border/50 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="font-semibold text-xs px-2.5 py-0.5">{b.name}</Badge>
                          {b.stance && (
                            <Badge className="bg-secondary text-secondary-foreground text-[11px] font-normal">
                              {b.stance}
                            </Badge>
                          )}
                        </div>
                        {b.model && (
                          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-muted/60 text-foreground/85 font-medium shrink-0 border-border/70">
                            🤖 {formatModelDisplayName(b.model)}
                          </Badge>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-[600px] overflow-y-auto pr-1 text-foreground/90">
                        {b.content ? (
                          b.content
                        ) : b.error ? (
                          <span className="text-destructive font-medium text-xs">⚠️ 研議失敗：{b.error}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs animate-pulse">合夥人思考撰寫中…</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}

        {/* 前次幕僚長決策報告 (接續新一輪攻防時暫存) */}
        {previousReport && (
          <Card className="border border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 p-4 space-y-2.5 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 font-medium">
                  📋 前次首席幕僚長決策報告（階段收斂）
                </Badge>
                <span className="text-xs text-muted-foreground">
                  目前正在進行新一輪深入推演，您可隨時參考前次報告
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPrevReport(v => !v)}
              >
                {showPrevReport ? '收合前次報告' : '展開檢視前次報告'}
              </Button>
            </div>
            {showPrevReport && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed border-t pt-3 max-h-80 overflow-y-auto prose dark:prose-invert max-w-none text-muted-foreground">
                {previousReport}
              </div>
            )}
          </Card>
        )}

        {/* 最終收斂決策報告 */}
        {(report || (running && (phase.includes('首席幕僚長') || phase.includes('出具') || phase.includes('收斂')))) && (
          <Card className="space-y-3 border-2 border-emerald-500 p-6 shadow-md bg-emerald-50/10 animate-in fade-in w-full">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                  👑 董事會首席幕僚長 · 最終高層決策報告
                </Badge>
                <Badge variant="outline" className="text-xs font-mono bg-background text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-medium">
                  主筆模型：{formatModelDisplayName(moderatorModel)}
                </Badge>
                {synthesisStyle !== 'default' && (
                  <Badge variant="secondary" className="text-xs">
                    {SYNTHESIS_STYLES.find(s => s.id === synthesisStyle)?.shortLabel}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                {running ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>首席幕僚長起草報告中…</span>
                  </>
                ) : (
                  '全場分歧收斂完畢 · 交付高層裁決'
                )}
              </span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed prose dark:prose-invert max-w-none">
              {report || (
                <div className="py-8 text-center text-muted-foreground space-y-2">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                  <p className="text-xs animate-pulse">首席幕僚長正在綜觀全場攻防與分歧，撰寫全景決策白皮書中…</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 🎛️ 老闆動態指揮台 (Human-in-the-Loop Console) - 永遠置於研議紀錄最下方，隨時接續同一議題討論 */}
        {(waitingBoss || (sessionId && blocks.length > 0)) && !running && (
          <Card id="boss-console" className="border-2 border-primary bg-primary/5 p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary px-2.5 py-1 text-xs">
                  {report ? '🎛️ 老闆指揮台（接續研議本議題）' : '🎛️ 老闆指揮台'}
                </Badge>
                <span className="text-sm font-medium">
                  {report
                    ? `本議題已完成第 ${completedRound} 輪攻防與決策報告，您可以隨時在下方追加指示繼續深化推演：`
                    : `第 ${completedRound} 輪攻防已完成，請下達下一步裁決：`}
                </span>
              </div>
              {viewingId && (
                <Badge variant="outline" className="text-xs bg-background">
                  議題延續中 · 無需從頭開始
                </Badge>
              )}
            </div>

            {/* 選擇行動類別 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBossAction('continue_all')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  bossAction === 'continue_all'
                    ? 'border-primary bg-background shadow-sm'
                    : 'border-border bg-muted/40 hover:bg-muted'
                }`}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  全體深入討論 (論述輪 + 互評輪)
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  輸入新指示，三位合夥人將針對老闆最新導向展開【第 {nextDiscussRound} 輪深化論述】，隨後自動進入【第 {nextRebutRound} 輪針鋒相對互評】
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBossAction('call_on')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  bossAction === 'call_on'
                    ? 'border-primary bg-background shadow-sm'
                    : 'border-border bg-muted/40 hover:bg-muted'
                }`}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-amber-500" />
                  點名單獨發言
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  點名某位合夥人在【第 {nextDiscussRound} 輪】單挑作答，隨後其他合夥人在【第 {nextRebutRound} 輪】展開質詢反駁
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBossAction('synthesize')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  bossAction === 'synthesize'
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-border bg-muted/40 hover:bg-emerald-50/20'
                }`}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {report ? '重新收斂結會 · 更新決策報告' : '討論已足夠 · 呼叫首席幕僚長結會'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  由首席幕僚長 ({formatModelDisplayName(moderatorModel)}) 綜觀全場包含最新輪次在內的所有分歧，出具最終決策報告
                </p>
              </button>
            </div>

            {/* 首席幕僚長結會選項與確認 */}
            {bossAction === 'synthesize' && (
              <div className="space-y-3 bg-background p-3.5 rounded-lg border text-xs animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    👑 首席幕僚長收斂設定：
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    可依本場辯論氛圍，隨時微調主筆模型與收斂風格
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">主筆幕僚長旗艦模型</label>
                    <select
                      value={moderatorModel}
                      onChange={e => setModeratorModel(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 bg-background text-foreground font-medium"
                    >
                      {MODERATOR_MODELS.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} —— {m.badge}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">決策收斂風格 (選填)</label>
                    <select
                      value={synthesisStyle}
                      onChange={e => setSynthesisStyle(e.target.value as SynthesisStyle)}
                      className="w-full border rounded px-2 py-1.5 bg-background text-foreground font-medium"
                    >
                      {SYNTHESIS_STYLES.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={() => submitBossStep('synthesize')}
                    disabled={running}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 font-medium"
                  >
                    {report ? '🚀 確認重新結會，產出最新首席幕僚長決策白皮書' : '🚀 確認結會，產出首席幕僚長決策白皮書'}
                  </Button>
                </div>
              </div>
            )}

            {/* 點名單挑選項 */}
            {bossAction === 'call_on' && (
              <div className="flex flex-wrap items-center gap-3 bg-background p-3 rounded-md border text-xs">
                <span className="font-semibold text-muted-foreground">點名指派：</span>
                <select
                  value={targetSeat}
                  onChange={e => setTargetSeat(e.target.value)}
                  className="border rounded px-2 py-1 bg-background text-foreground font-medium"
                >
                  {customSeats.map((cs, i) => {
                    const n = cs.name.trim() || DEFAULT_SEAT_NAMES[i]
                    return (
                      <option key={n} value={n}>{n}</option>
                    )
                  })}
                </select>
                <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={crossExamine}
                    onChange={e => setCrossExamine(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>作答後允許其他合夥人針對此回答反駁</span>
                </label>
              </div>
            )}

            {/* 指示輸入框 */}
            {bossAction !== 'synthesize' && (
              <div className="space-y-2">
                <Textarea
                  value={bossInput}
                  onChange={e => setBossInput(e.target.value)}
                  placeholder={
                    bossAction === 'call_on'
                      ? `請輸入對 ${targetSeat} 的具體質疑或追問... (例如：你剛才提出的毛利假設，如果對手降價 15% 你該如何因應？)`
                      : '請輸入老闆的宏觀指示... (例如：大家不要再吵短線價格戰，請針對三年後的生態護城河與轉移成本進一步深化)'
                  }
                  rows={2}
                />
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-muted-foreground">下一輪篇幅：</span>
                    <div className="flex items-center gap-1">
                      {VERBOSITY_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setVerbosity(opt.id)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                            verbosity === opt.id
                              ? 'bg-primary text-primary-foreground border-primary font-semibold'
                              : 'bg-background text-muted-foreground border-border hover:bg-muted'
                          )}
                          title={opt.description}
                        >
                          {opt.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => submitBossStep()}
                    disabled={!bossInput.trim() || running}
                    className="px-6"
                  >
                    發送指示並繼續會議
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
