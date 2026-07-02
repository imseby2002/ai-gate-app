'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

interface SeatBlock {
  round: number
  name: string
  model?: string
  content: string
}

const PHASE_LABEL: Record<number, string> = {
  1: '第一輪 · 獨立研議',
  2: '第二輪 · 互評補強',
  3: '第三輪 · 彙整報告',
}

export default function RoundtablePage() {
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [blocks, setBlocks] = useState<SeatBlock[]>([])
  const [report, setReport] = useState('')
  const [phase, setPhase] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  async function start() {
    if (!instruction.trim() || running) return
    setRunning(true)
    setBlocks([])
    setReport('')
    setPhase('')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
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
      <div>
        <h1 className="text-2xl font-bold">AI 圓桌研議</h1>
        <p className="text-sm text-muted-foreground">
          下達指令，指派數個大模型「員工」分輪研究、互評，最後由整合者彙整成完整報告。
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <Textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="老闆，請下指令… (例：評估我們是否該推出訂閱制方案，給完整建議)"
          rows={4}
          disabled={running}
        />
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
