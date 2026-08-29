'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import { ExpertSelector } from '@/components/experts/ExpertSelector'

interface SeatBlock {
  round: number
  name: string
  model?: string
  content: string
}

interface SessionSummary {
  id: string
  instruction: string
  created_at: string
}

const PHASE_LABEL: Record<number, string> = {
  1: '第一輪 · 獨立研議',
  2: '第二輪 · 互評補強',
  3: '第三輪 · 彙整報告',
}

const DEFAULT_SEAT_NAMES = ['員工A', '員工B', '員工C']

export default function RoundtablePage() {
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [blocks, setBlocks] = useState<SeatBlock[]>([])
  const [report, setReport] = useState('')
  const [phase, setPhase] = useState('')
  const [showExpertConfig, setShowExpertConfig] = useState(false)
  // 每個席位選的 expertId（單選）：index → expertId[]
  const [seatExperts, setSeatExperts] = useState<Record<number, string[]>>({ 0: [], 1: [], 2: [] })
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
      setBlocks(
        (session.transcript ?? []).map((t: { round: number; name: string; content: string }) => ({
          round: t.round,
          name: t.name,
          model: seatModelByName.get(t.name),
          content: t.content,
        }))
      )
      setReport(session.report ?? '')
      setPhase('')
      setViewingId(session.id)
      setShowHistory(false)
    } finally {
      setLoadingSession(false)
    }
  }

  function setSeatExpert(idx: number, ids: string[]) {
    setSeatExperts(prev => ({ ...prev, [idx]: ids }))
  }

  async function start() {
    if (!instruction.trim() || running) return
    setRunning(true)
    setBlocks([])
    setReport('')
    setPhase('')
    setViewingId(null)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // 只傳 expertId 陣列，讓 API 合併進 DEFAULT_SEATS
    const seatExpertIds = DEFAULT_SEAT_NAMES.map((_, i) => seatExperts[i]?.[0] ?? null)
    const hasExperts = seatExpertIds.some(Boolean)

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, seatExpertIds: hasExperts ? seatExpertIds : undefined }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'failed' }))
        setReport(`⚠️ ${err.error ?? '請求失敗'}`)
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
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

          if (e.type === 'phase') {
            setPhase(e.label)
          } else if (e.type === 'seat-start') {
            setBlocks(prev => [...prev, { round: e.round, name: e.name, model: e.model, content: '' }])
          } else if (e.type === 'delta') {
            setBlocks(prev => {
              const next = [...prev]
              const idx = next.findLastIndex(b => b.round === e.round && b.name === e.name)
              if (idx >= 0) next[idx] = { ...next[idx], content: next[idx].content + e.content }
              return next
            })
          } else if (e.type === 'report') {
            setReport(e.content)
          } else if (e.type === 'error') {
            setReport(prev => prev + `\n⚠️ ${e.name}: ${e.error}`)
          }
        }
      }
    } catch {
      // aborted or network error
    } finally {
      setRunning(false)
      fetchHistory()
    }
  }

  function stop() {
    abortRef.current?.abort()
    setRunning(false)
  }

  const byRound = [1, 2, 3].map(r => ({ round: r, items: blocks.filter(b => b.round === r) }))

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI 圓桌研議</h1>
          <p className="text-sm text-muted-foreground">
            下達指令，指派數個大模型「員工」分輪研究、互評，最後由整合者彙整成完整報告。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(v => !v)}>
          <History className="mr-1.5 h-4 w-4" />
          歷史紀錄
        </Button>
      </div>

      {showHistory && (
        <Card className="p-4 space-y-2">
          <p className="text-sm font-medium">過往研議紀錄</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">還沒有任何紀錄</p>
          ) : (
            <div className="divide-y">
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

      {viewingId && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span>正在檢視歷史紀錄</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-0.5"
            onClick={() => { setViewingId(null); setBlocks([]); setReport(''); setInstruction('') }}
          >
            開始新的研議
          </Button>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <Textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="老闆，請下指令… (例：評估我們是否該推出訂閱制方案，給完整建議)"
          rows={4}
          disabled={running}
        />

        {/* 席位專家設定（可收合） */}
        <div className="border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExpertConfig(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>引入專家知識（選填）</span>
            {showExpertConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showExpertConfig && (
            <div className="border-t divide-y">
              {DEFAULT_SEAT_NAMES.map((name, i) => (
                <div key={name} className="p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{name} 的專家視角</p>
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

        <div className="flex gap-2">
          <Button onClick={start} disabled={running || !instruction.trim()}>
            {running ? '研議中…' : '開始研議'}
          </Button>
          {running && (
            <Button variant="outline" onClick={stop}>
              停止
            </Button>
          )}
          {phase && <span className="self-center text-sm text-muted-foreground">{phase}</span>}
        </div>
      </Card>

      {byRound.map(({ round, items }) =>
        items.length === 0 ? null : (
          <div key={round} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{PHASE_LABEL[round]}</h2>
            {items.map((b, i) => (
              <Card key={`${round}-${b.name}-${i}`} className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge>{b.name}</Badge>
                  {b.model && <span className="text-xs text-muted-foreground">{b.model}</span>}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {b.content || <span className="text-muted-foreground">思考中…</span>}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {report && (
        <Card className="space-y-2 border-primary p-5">
          <div className="flex items-center gap-2">
            <Badge>交付老闆 · 最終報告</Badge>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{report}</div>
        </Card>
      )}
    </div>
    </div>
  )
}
