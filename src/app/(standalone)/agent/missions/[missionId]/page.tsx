'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Play, Pause, RotateCcw, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { MISSION_STATUS_VARIANT } from '../../MissionsPanel'

interface Kpi {
  key: string; name: string; target: number; unit: string; due?: string | null
  measurement?: string; current?: number | null; source?: string | null
}
interface PlanTask {
  id?: string; title?: string; channel?: string; resource?: string; tool?: string
  vendor_type?: string; est_cost?: number; executor?: string
}
interface PlanPhase { name?: string; start_date?: string; end_date?: string; goal?: string; tasks?: PlanTask[] }
interface Plan {
  title?: string
  summary?: string
  feasibility?: { verdict?: string; reason?: string; adjusted_target?: string }
  assumptions?: string[]
  situation?: { internal_resources_used?: string[]; gaps?: string[] }
  strategy?: { channel?: string; why?: string; approach?: string }[]
  phases?: PlanPhase[]
  budget?: { currency?: string; total?: number; lines?: { item?: string; type?: string; amount?: number; why?: string }[]; reserve?: number }
  human_actions?: string[]
  risks?: { risk?: string; mitigation?: string }[]
}
interface Mission {
  id: string; role_id: string; objective: string; status: string
  budget_amount: number; budget_currency: string; budget_spent: number; deadline: string | null
  plan: Plan; kpis: Kpi[]; progress_log: { at: string; note: string }[]; last_error: string | null; run_id: string | null
}
interface Expense { id: string; vendor: string; description: string; amount: number; status: string; url: string | null; created_at: string }
interface RunInfo { id: string; status: string; next_tick_at: string; total_credits_spent: number; waitingUntil?: string | null }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-2">{children}</CardContent>
    </Card>
  )
}

function List({ items }: { items?: string[] }) {
  if (!items?.length) return null
  return <ul className="list-disc pl-5 space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
}

export default function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = use(params)
  const t = useTranslations('AgentMission')
  const locale = useLocale()
  const dateLocale = locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW'

  const [mission, setMission] = useState<Mission | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [run, setRun] = useState<RunInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/agent/missions/${missionId}`).then(r => r.json()).catch(() => ({}))
    setMission(res.mission ?? null)
    setExpenses(res.expenses ?? [])
    const r = res.run as RunInfo | null
    // 長期任務由 schedule_next_check 延後的下次檢查時間（在載入時判斷，避免 render 期間呼叫 Date.now）
    setRun(r ? { ...r, waitingUntil: r.status === 'running' && new Date(r.next_tick_at).getTime() > Date.now() ? r.next_tick_at : null } : null)
    setLoading(false)
  }, [missionId])

  useEffect(() => { load() }, [load])

  const act = async (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(action)
    setError(null)
    const res = await fetch(`/api/agent/missions/${missionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, feedback }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setError(data.error ?? 'Error')
    else if (action === 'replan') setFeedback('')
    await load()
    setBusy(null)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }
  if (!mission) {
    return <div className="px-6 py-6"><Link href="/agent" className="text-sm underline">{t('back')}</Link></div>
  }

  const plan = mission.plan ?? {}
  const verdict = plan.feasibility?.verdict

  return (
    <div className="px-6 py-6 space-y-4 max-w-5xl mx-auto">
      <Link href="/agent" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />{t('back')}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{plan.title || mission.objective}</h1>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{mission.objective}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {mission.role_id} · {t('spentOf', { spent: mission.budget_spent, total: mission.budget_amount, currency: mission.budget_currency })}
            {mission.deadline && <> · {t('kpiDue', { due: mission.deadline })}</>}
          </p>
        </div>
        <Badge variant={MISSION_STATUS_VARIANT[mission.status] ?? 'secondary'} className="shrink-0">{t(`status_${mission.status}`)}</Badge>
      </div>

      {mission.last_error && <p className="text-sm text-destructive">{mission.last_error}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {mission.status === 'plan_ready' && (
          <Button disabled={!!busy} onClick={() => act('execute', t('executeConfirm'))}>
            {busy === 'execute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{t('execute')}
          </Button>
        )}
        {mission.status === 'executing' && (
          <Button variant="secondary" disabled={!!busy} onClick={() => act('pause')}>
            <Pause className="h-4 w-4" />{t('pause')}
          </Button>
        )}
        {mission.status === 'paused' && (
          <Button disabled={!!busy} onClick={() => act('resume')}>
            <Play className="h-4 w-4" />{t('resume')}
          </Button>
        )}
        {!['completed', 'cancelled'].includes(mission.status) && (
          <Button variant="destructive" disabled={!!busy} onClick={() => act('cancel', t('cancelConfirm'))}>
            <XCircle className="h-4 w-4" />{t('cancel')}
          </Button>
        )}
        {run && (
          <Link href={`/agent/runs/${run.id}`} className="text-sm underline self-center">{t('viewRun')}</Link>
        )}
      </div>
      {run && (
        <p className="text-xs text-muted-foreground">
          {t('runStatus', { status: run.status })}
          {run.waitingUntil && (
            <> · {t('nextCheck', { at: new Date(run.waitingUntil).toLocaleString(dateLocale) })}</>
          )}
        </p>
      )}

      {['plan_ready', 'failed', 'paused'].includes(mission.status) && (
        <div className="flex gap-2 items-start">
          <Textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder={t('feedbackPlaceholder')}
            className="flex-1 min-h-[60px]"
          />
          <Button variant="secondary" disabled={!!busy} onClick={() => act('replan')}>
            {busy === 'replan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {busy === 'replan' ? t('generating') : t('replan')}
          </Button>
        </div>
      )}

      {plan.feasibility && (
        <Card className={verdict === 'unrealistic' ? 'border-destructive' : verdict === 'stretch' ? 'border-amber-500' : ''}>
          <CardContent className="py-4 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium">
              {verdict !== 'realistic' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {t('feasibility')}：{verdict && ['realistic', 'stretch', 'unrealistic'].includes(verdict) ? t(`verdict_${verdict}`) : verdict}
            </div>
            {plan.feasibility.reason && <p>{plan.feasibility.reason}</p>}
            {plan.feasibility.adjusted_target && <p><b>{t('adjustedTarget')}：</b>{plan.feasibility.adjusted_target}</p>}
          </CardContent>
        </Card>
      )}

      {plan.summary && <Section title={t('summary')}><p className="whitespace-pre-wrap">{plan.summary}</p></Section>}

      {mission.kpis?.length > 0 && (
        <Section title={t('kpis')}>
          {mission.kpis.map(k => {
            const pct = k.current != null && k.target > 0 ? Math.min(100, Math.round((k.current / k.target) * 100)) : 0
            return (
              <div key={k.key} className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{k.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {k.current != null ? t('kpiCurrent', { current: k.current }) : t('kpiNoData')} · {t('kpiTarget', { target: k.target, unit: k.unit })}
                    {k.due && <> · {t('kpiDue', { due: k.due })}</>}
                  </span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                {k.measurement && <p className="text-xs text-muted-foreground">{k.measurement}</p>}
                {k.source && <p className="text-xs text-muted-foreground">{t('kpiSource', { source: k.source })}</p>}
              </div>
            )
          })}
        </Section>
      )}

      {plan.assumptions?.length ? <Section title={t('assumptions')}><List items={plan.assumptions} /></Section> : null}

      {(plan.situation?.internal_resources_used?.length || plan.situation?.gaps?.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title={t('resources')}><List items={plan.situation?.internal_resources_used} /></Section>
          <Section title={t('gaps')}><List items={plan.situation?.gaps} /></Section>
        </div>
      ) : null}

      {plan.strategy?.length ? (
        <Section title={t('strategy')}>
          {plan.strategy.map((s, i) => (
            <div key={i}>
              <div className="font-medium">{s.channel}</div>
              {s.why && <p className="text-muted-foreground">{s.why}</p>}
              {s.approach && <p>{s.approach}</p>}
            </div>
          ))}
        </Section>
      ) : null}

      {plan.phases?.length ? (
        <Section title={t('phases')}>
          {plan.phases.map((p, i) => (
            <div key={i} className="space-y-2">
              <div className="font-medium">{p.name} <span className="text-xs text-muted-foreground">{p.start_date} ~ {p.end_date}</span></div>
              {p.goal && <p className="text-muted-foreground">{p.goal}</p>}
              <div className="space-y-1">
                {(p.tasks ?? []).map((task, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2 border rounded px-2 py-1">
                    <span className="text-xs text-muted-foreground">{task.id}</span>
                    <span className="flex-1 min-w-[12rem]">{task.title}</span>
                    {task.channel && <Badge variant="secondary">{task.channel}</Badge>}
                    {task.resource && ['internal', 'external', 'human'].includes(task.resource) && <Badge variant={task.resource === 'external' ? 'warning' : 'secondary'}>{t(`resource_${task.resource}`)}</Badge>}
                    {task.executor && ['agent', 'human'].includes(task.executor) && <Badge variant={task.executor === 'human' ? 'destructive' : 'default'}>{t(`executor_${task.executor}`)}</Badge>}
                    {!!task.est_cost && <span className="text-xs">{task.est_cost}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      {plan.budget?.lines?.length ? (
        <Section title={t('budgetPlan')}>
          {plan.budget.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span>{l.item}{l.why && <span className="text-muted-foreground"> — {l.why}</span>}</span>
              <span className="shrink-0">{l.amount} {plan.budget?.currency}</span>
            </div>
          ))}
          {!!plan.budget.reserve && <p className="text-muted-foreground">{t('reserve', { amount: plan.budget.reserve })}</p>}
        </Section>
      ) : null}

      {plan.human_actions?.length ? <Section title={t('humanActions')}><List items={plan.human_actions} /></Section> : null}

      {plan.risks?.length ? (
        <Section title={t('risks')}>
          {plan.risks.map((r, i) => <p key={i}><b>{r.risk}</b>：{r.mitigation}</p>)}
        </Section>
      ) : null}

      {expenses.length > 0 && (
        <Section title={t('expenses')}>
          {expenses.map(e => (
            <div key={e.id} className="flex justify-between gap-2 items-center">
              <span className="min-w-0">
                <b>{e.vendor}</b> — {e.description}
                {e.url && <> · <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">link</a></>}
              </span>
              <span className="shrink-0 flex items-center gap-2">
                {e.amount} {mission.budget_currency}
                <Badge variant={e.status === 'approved' || e.status === 'paid' ? 'success' : e.status === 'proposed' ? 'warning' : 'secondary'}>
                  {t(`expense_${e.status}`)}
                </Badge>
              </span>
            </div>
          ))}
        </Section>
      )}

      {mission.progress_log?.length > 0 && (
        <Section title={t('progress')}>
          {[...mission.progress_log].reverse().map((p, i) => (
            <div key={i}>
              <span className="text-xs text-muted-foreground">{new Date(p.at).toLocaleString(dateLocale)}</span>
              <p className="whitespace-pre-wrap">{p.note}</p>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}
