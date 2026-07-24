'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RunStep {
  id: string
  step_index: number
  phase: string
  tool_id: string | null
  tool_input: unknown
  tool_output: unknown
  thought: string | null
  model_id: string | null
  credits_spent: number
  created_at: string
}

interface RunDetail {
  id: string
  role_id: string
  status: string
  goal: string
  total_credits_spent: number
  created_at: string
  completed_at: string | null
  last_error: string | null
}

const PHASE_LABEL: Record<string, string> = {
  plan: '規劃',
  tool_call: '工具呼叫',
  tool_result: '工具結果',
  self_critique: '自我檢討',
  notify: '通知',
  approval_requested: '請求核准',
  approval_resolved: '核准結果',
  error: '錯誤',
  final_report: '總結報告',
}

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [steps, setSteps] = useState<RunStep[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/agent/runs/${runId}`)
    if (res.ok) {
      const data = await res.json()
      setRun(data.run)
      setSteps(data.steps ?? [])
    }
    setLoading(false)
  }, [runId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!run) {
    return <div className="px-8 py-8"><p className="text-sm text-muted-foreground">找不到此執行紀錄。</p></div>
  }

  return (
    <div className="px-8 py-8 space-y-6 max-w-4xl mx-auto">
      <Link href="/agent" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />返回
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{run.goal}</h1>
          <Badge>{run.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          角色：{run.role_id} · 建立於 {new Date(run.created_at).toLocaleString('zh-TW')} · 累計花費 ${run.total_credits_spent?.toFixed(4)}
        </p>
        {run.last_error && <p className="text-sm text-destructive mt-1">最近錯誤：{run.last_error}</p>}
      </div>

      <div className="space-y-3">
        {steps.length === 0 && <p className="text-sm text-muted-foreground">尚無步驟紀錄。</p>}
        {steps.map(step => (
          <Card key={step.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">#{step.step_index}</span>
                <Badge variant="outline">{PHASE_LABEL[step.phase] ?? step.phase}</Badge>
                {step.tool_id && <span className="text-xs text-muted-foreground">{step.tool_id}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{new Date(step.created_at).toLocaleTimeString('zh-TW')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-4 space-y-2 text-sm">
              {step.thought && <p className="whitespace-pre-wrap">{step.thought}</p>}
              {step.tool_input != null && (
                <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto">{JSON.stringify(step.tool_input, null, 2)}</pre>
              )}
              {step.tool_output != null && (
                <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto">{JSON.stringify(step.tool_output, null, 2)}</pre>
              )}
              {step.credits_spent > 0 && (
                <p className="text-xs text-muted-foreground">花費 ${step.credits_spent.toFixed(4)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
