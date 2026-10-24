'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  ArrowLeft, Loader2, Brain, Wrench, CheckCircle2, AlertCircle, Bell, ShieldCheck, FileText, MessageSquare,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RunStep {
  id: string
  step_index: number
  phase: string
  tool_id: string | null
  summary?: string
  tool_input?: unknown
  tool_output?: unknown
  thought: string | null
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
  last_error: string | null
}

const PHASE_ICON: Record<string, React.ElementType> = {
  plan: Brain, tool_call: Wrench, tool_result: CheckCircle2, self_critique: MessageSquare,
  notify: Bell, approval_requested: ShieldCheck, approval_resolved: ShieldCheck, error: AlertCircle, final_report: FileText,
}

const STATUS_KEY: Record<string, string> = {
  queued: 'statusQueued', running: 'statusRunning', waiting_approval: 'statusWaitingApproval',
  waiting_input: 'statusWaitingInput', paused: 'statusPaused', completed: 'statusCompleted',
  failed: 'statusFailed', cancelled: 'statusCancelled',
}

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params)
  const t = useTranslations('AgentRun')
  const tp = useTranslations('AgentPage')
  const locale = useLocale()
  const dateLocale = locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW'
  const [run, setRun] = useState<RunDetail | null>(null)
  const [steps, setSteps] = useState<RunStep[]>([])
  const [canDebug, setCanDebug] = useState(false)
  const [roleLabel, setRoleLabel] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/agent/runs/${runId}`)
    if (res.ok) {
      const data = await res.json()
      setRun(data.run)
      setSteps(data.steps ?? [])
      setCanDebug(!!data.canDebug)
      fetch('/api/agent/roles').then(r => (r.ok ? r.json() : null)).then(d => {
        const role = (d?.roles ?? []).find((r: { id: string; label?: string }) => r.id === data.run?.role_id)
        if (role?.label) setRoleLabel(role.label)
      }).catch(() => {})
    }
    setLoading(false)
  }, [runId])

  useEffect(() => { load() }, [load])

  const toolLabel = (id: string | null) => (id && t.has(`tool.${id}`) ? t(`tool.${id}`) : t('tool.generic'))
  const phaseLabel = (p: string) => (t.has(`phase.${p}`) ? t(`phase.${p}`) : p)

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!run) {
    return <div className="px-6 py-6"><p className="text-sm text-muted-foreground">{t('notFound')}</p></div>
  }

  // 工具呼叫與其結果是同一件事，只顯示一筆（以結果為主）
  const visible = steps.filter((s, i) => !(s.phase === 'tool_call' && steps[i + 1]?.phase === 'tool_result' && steps[i + 1]?.tool_id === s.tool_id))

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto">
      <Link href="/agent" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />{t('back')}
      </Link>

      <div>
        <div className="flex items-start gap-2 flex-wrap">
          <h1 className="text-xl font-bold flex-1 min-w-0">{run.goal}</h1>
          <Badge>{STATUS_KEY[run.status] ? tp(STATUS_KEY[run.status]) : run.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {t('meta', {
            role: roleLabel || run.role_id,
            time: new Date(run.created_at).toLocaleString(dateLocale),
            cost: `$${(run.total_credits_spent ?? 0).toFixed(4)}`,
          })}
        </p>
        {run.last_error && <p className="text-sm text-destructive mt-1">{t('lastError')}{run.last_error}</p>}
      </div>

      <div className="space-y-2.5">
        {visible.length === 0 && <p className="text-sm text-muted-foreground">{t('noSteps')}</p>}
        {visible.map((step, i) => {
          const Icon = PHASE_ICON[step.phase] ?? Wrench
          const isTool = step.phase === 'tool_call' || step.phase === 'tool_result'
          const title = isTool ? toolLabel(step.tool_id) : phaseLabel(step.phase)
          return (
            <Card key={step.id}>
              <CardContent className="py-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${step.phase === 'error' ? 'text-destructive' : 'text-primary'}`} />
                  <span className="font-medium">{title}</span>
                  {isTool && step.phase === 'tool_result' && <span className="text-[11px] text-emerald-600">{t('done')}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(step.created_at).toLocaleTimeString(dateLocale)}</span>
                </div>
                {step.thought && <p className="whitespace-pre-wrap pl-7 text-muted-foreground">{step.thought}</p>}
                {!step.thought && step.summary && <p className="whitespace-pre-wrap pl-7 text-muted-foreground">{step.summary}</p>}
                {step.credits_spent > 0 && (
                  <p className="text-xs text-muted-foreground pl-7">{t('spent', { cost: `$${step.credits_spent.toFixed(4)}` })}</p>
                )}
                {canDebug && (step.tool_input != null || step.tool_output != null) && (
                  <details className="pl-7">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer select-none">{t('techDetails')}</summary>
                    {step.tool_input != null && (
                      <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto mt-1">{JSON.stringify(step.tool_input, null, 2)}</pre>
                    )}
                    {step.tool_output != null && (
                      <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto mt-1 max-h-80">{JSON.stringify(step.tool_output, null, 2)}</pre>
                    )}
                  </details>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
