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
} from 'lucide-react'
import { ExpertSelector } from '@/components/experts/ExpertSelector'
import type { RoundtableDomain } from '@/lib/ai/roundtable'

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

const DOMAIN_OPTIONS: { id: RoundtableDomain; label: string; icon: typeof TrendingUp }[] = [
  { id: 'auto', label: '智慧自動', icon: Sparkles },
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

  // 歷史紀錄
  const [history, setHistory] = useState<SessionSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchHistory()
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
      setBlocks(
        (session.transcript ?? []).map((t: { round: number; name: string; content: string; stance?: string }) => ({
          round: t.round,
          name: t.name,
          model: seatModelByName.get(t.name),
          stance: t.stance,
          content: t.content,
        }))
      )
      setReport(session.report ?? '')
      setPhase('')
      setSessionId(session.id)
      setViewingId(session.id)
      setWaitingBoss(session.status === 'waiting_boss' && !session.report)
      setShowHistory(false)
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
    setRunning(true)
    setBlocks([])
    setFactBriefing('')
    setReport('')
    setPhase('')
    setViewingId(null)
    setSessionId(null)
    setWaitingBoss(false)
    setBossInput('')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const seatExpertIds = DEFAULT_SEAT_NAMES.map((_, i) => seatExperts[i]?.[0] ?? null)
    const hasExperts = seatExpertIds.some(Boolean)

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          domain: selectedDomain,
          seatExpertIds: hasExperts ? seatExpertIds : undefined,
          interactive: true,
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
      const currentMaxRound = blocks.reduce((max, b) => Math.max(max, b.round), 2)
      setBlocks(prev => [
        ...prev,
        {
          round: currentMaxRound + 1,
          name: '老闆指令',
          stance: currentAction === 'call_on' ? `點名 ${targetSeat}` : '全體深化',
          content: bossInput.trim(),
        },
      ])
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
          setBlocks(prev => [
            ...prev,
            { round: e.round, name: e.name, model: e.model, stance: e.stance, content: '' },
          ])
        } else if (e.type === 'delta') {
          setBlocks(prev => {
            const next = [...prev]
            const idx = next.findLastIndex(b => b.round === e.round && b.name === e.name)
            if (idx >= 0) next[idx] = { ...next[idx], content: next[idx].content + e.content }
            return next
          })
        } else if (e.type === 'seat-end') {
          if (e.error) {
            setBlocks(prev => {
              const next = [...prev]
              const idx = next.findLastIndex(b => b.round === e.round && b.name === e.name)
              if (idx >= 0) next[idx] = { ...next[idx], error: e.error }
              return next
            })
          }
        } else if (e.type === 'waiting_boss') {
          setWaitingBoss(true)
          setPhase('⏸️ 會議暫停 · 等待老闆裁示')
        } else if (e.type === 'report') {
          setReport(e.content)
          setWaitingBoss(false)
        } else if (e.type === 'error') {
          if (e.name === 'system') {
            setReport(prev => (prev ? `${prev}\n⚠️ ${e.error}` : `⚠️ ${e.error}`))
          }
        }
      }
    }
  }

  function stop() {
    abortRef.current?.abort()
    setRunning(false)
  }

  // 計算輪次列表 (過濾出所有大於 0 的輪次)
  const roundNumbers = [...new Set(blocks.map(b => b.round))].sort((a, b) => a - b)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* 標題與歷史紀錄按鈕 */}
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
          <Button variant="outline" size="sm" onClick={() => setShowHistory(v => !v)}>
            <History className="mr-1.5 h-4 w-4" />
            歷史紀錄
          </Button>
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
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span>正在檢視過往研議紀錄</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1"
              onClick={() => {
                setViewingId(null)
                setSessionId(null)
                setBlocks([])
                setFactBriefing('')
                setReport('')
                setInstruction('')
                setWaitingBoss(false)
              }}
            >
              開始新的會議
            </Button>
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
                {DEFAULT_SEAT_NAMES.map((name, i) => (
                  <div key={name} className="p-2.5 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{name} 專屬知識庫</p>
                    <ExpertSelector
                      selectedIds={seatExperts[i] ?? []}
                      onChange={ids => setSeatExpert(i, ids)}
                      single
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={start} disabled={running || !instruction.trim()}>
                {running ? '會議進行中…' : '召開圓桌會議'}
              </Button>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 hover:bg-blue-700">📊 資料專員 · 會前客觀事實簡報 (Fact Sheet)</Badge>
                <span className="text-xs text-muted-foreground">Google 即時檢索已查證</span>
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
              <div className="whitespace-pre-wrap text-sm leading-relaxed border-t pt-2 max-h-96 overflow-y-auto font-mono text-xs">
                {factBriefing}
              </div>
            )}
          </Card>
        )}

        {/* 逐輪發言內容呈現 */}
        {roundNumbers.map(roundNum => {
          const items = blocks.filter(b => b.round === roundNum)
          const bossMsg = items.find(b => b.name === '老闆指令')
          const seatItems = items.filter(b => b.name !== '老闆指令')

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
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {roundNum === 1 ? '第一輪 · 獨立研議 (平行)' : roundNum === 2 ? '第二輪 · 針鋒相對 (互評)' : `第 ${roundNum} 輪 · 深化研議`}
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {seatItems.map((b, i) => (
                  <Card key={`${roundNum}-${b.name}-${i}`} className="p-4 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <Badge variant="outline" className="font-semibold">{b.name}</Badge>
                        {b.model && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{b.model}</span>}
                      </div>
                      {b.stance && (
                        <div className="mb-2">
                          <Badge className="bg-secondary text-secondary-foreground text-[11px] font-normal">
                            {b.stance}
                          </Badge>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto">
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

        {/* 🎛️ 老闆動態指揮台 (Human-in-the-Loop Console) */}
        {waitingBoss && !running && (
          <Card className="border-2 border-primary bg-primary/5 p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary px-2.5 py-1 text-xs">🎛️ 老闆指揮台</Badge>
                <span className="text-sm font-medium">第二輪攻防已完成，請下達下一步裁決：</span>
              </div>
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
                  全體深入討論
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  輸入新指示，三位合夥人帶著導向進行下一輪平行攻防
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
                  點名某位合夥人針對特定疑點單挑作答，隨後同儕反駁
                </p>
              </button>

              <button
                type="button"
                onClick={() => submitBossStep('synthesize')}
                className="p-3 rounded-lg border border-border bg-muted/40 hover:bg-primary/10 text-left transition-all"
              >
                <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  討論已足夠 · 結會
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  隨時收斂，呼叫整合者產出交付高層的完整決策報告
                </p>
              </button>
            </div>

            {/* 點名單挑選項 */}
            {bossAction === 'call_on' && (
              <div className="flex flex-wrap items-center gap-3 bg-background p-3 rounded-md border text-xs">
                <span className="font-semibold text-muted-foreground">點名指派：</span>
                <select
                  value={targetSeat}
                  onChange={e => setTargetSeat(e.target.value)}
                  className="border rounded px-2 py-1 bg-background text-foreground"
                >
                  {DEFAULT_SEAT_NAMES.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
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
                <div className="flex justify-end gap-2">
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

        {/* 最終收斂決策報告 */}
        {report && (
          <Card className="space-y-3 border-2 border-emerald-500 p-6 shadow-md bg-emerald-50/10">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  🏆 交付老闆 · 最終高層決策報告
                </Badge>
                <span className="text-xs text-muted-foreground">整合者 (Claude Opus) 全場收斂</span>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed prose dark:prose-invert max-w-none">
              {report}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
