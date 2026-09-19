'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Bot, Play, CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

type Tab = 'roles' | 'runs' | 'approvals'

interface AgentRole {
  id: string
  label: string
  description: string
  category: string
  userRole: { enabled: boolean; id: string } | null
}

interface AgentRun {
  id: string
  role_id: string
  status: string
  goal: string
  total_credits_spent: number
  created_at: string
  last_error: string | null
}

interface AgentApproval {
  id: string
  role_id: string | null
  action_type: string
  summary: string
  risk_level: string
  channel: string
  requested_at: string
}

export default function AgentPage() {
  const t = useTranslations('AgentPage')
  const locale = useLocale()
  const dateLocale = locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW'
  const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
    queued: { label: t('statusQueued'), variant: 'secondary' },
    running: { label: t('statusRunning'), variant: 'default' },
    waiting_approval: { label: t('statusWaitingApproval'), variant: 'warning' },
    waiting_input: { label: t('statusWaitingInput'), variant: 'warning' },
    paused: { label: t('statusPaused'), variant: 'destructive' },
    completed: { label: t('statusCompleted'), variant: 'success' },
    failed: { label: t('statusFailed'), variant: 'destructive' },
    cancelled: { label: t('statusCancelled'), variant: 'secondary' },
  }
  const [tab, setTab] = useState<Tab>('roles')
  const [roles, setRoles] = useState<AgentRole[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [approvals, setApprovals] = useState<AgentApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [rolesRes, runsRes, approvalsRes] = await Promise.all([
      fetch('/api/agent/roles').then(r => r.json()),
      fetch('/api/agent/runs').then(r => r.json()),
      fetch('/api/agent/approvals').then(r => r.json()),
    ])
    setRoles(rolesRes.roles ?? [])
    setRuns(runsRes.runs ?? [])
    setApprovals(approvalsRes.approvals ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const toggleRole = async (roleId: string, enabled: boolean) => {
    setBusy(roleId)
    await fetch('/api/agent/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId, enabled }),
    })
    await loadAll()
    setBusy(null)
  }

  const startRun = async (roleId: string) => {
    const goal = goalDrafts[roleId]?.trim()
    if (!goal) return
    setBusy(roleId + ':run')
    const res = await fetch('/api/agent/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId, goal }),
    })
    if (res.ok) {
      setGoalDrafts(d => ({ ...d, [roleId]: '' }))
      setTab('runs')
    }
    await loadAll()
    setBusy(null)
  }

  const respondApproval = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    await fetch(`/api/agent/approvals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await loadAll()
    setBusy(null)
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-zinc-900 flex items-center justify-center">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {([
          ['roles', t('tabRoles')],
          ['runs', t('tabRuns')],
          ['approvals', approvals.length ? t('tabApprovalsCount', { n: approvals.length }) : t('tabApprovals')],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'roles' ? (
        <div className="space-y-4">
          {roles.length === 0 && <p className="text-sm text-muted-foreground">{t('noRoles')}</p>}
          {roles.map(role => {
            const enabled = !!role.userRole?.enabled
            return (
              <Card key={role.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant={enabled ? 'secondary' : 'default'}
                    disabled={busy === role.id}
                    onClick={() => toggleRole(role.id, !enabled)}
                  >
                    {busy === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? t('disable') : t('enable')}
                  </Button>
                </CardHeader>
                {enabled && role.id === 'secretary' && (
                  <CardContent className="pb-0">
                    <a href="/api/integrations/google-calendar/auth" className="text-xs text-primary underline">
                      {t('connectGoogleCalendar')}
                    </a>
                  </CardContent>
                )}
                {enabled && (
                  <CardContent className="flex gap-2 items-start">
                    <Textarea
                      placeholder={t('goalPlaceholder')}
                      value={goalDrafts[role.id] ?? ''}
                      onChange={e => setGoalDrafts(d => ({ ...d, [role.id]: e.target.value }))}
                      className="flex-1 min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      disabled={busy === role.id + ':run' || !goalDrafts[role.id]?.trim()}
                      onClick={() => startRun(role.id)}
                    >
                      {busy === role.id + ':run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {t('assign')}
                    </Button>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      ) : tab === 'runs' ? (
        <div className="space-y-3">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">{t('noRuns')}</p>}
          {runs.map(run => {
            const s = STATUS_LABEL[run.status] ?? { label: run.status, variant: 'secondary' as const }
            return (
              <Link key={run.id} href={`/agent/runs/${run.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{run.goal}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {new Date(run.created_at).toLocaleString(dateLocale)}
                        <span>· {run.role_id}</span>
                        <span>· {t('spent', { amount: run.total_credits_spent?.toFixed(4) ?? '0' })}</span>
                      </div>
                      {run.last_error && <div className="text-xs text-destructive mt-1">{run.last_error}</div>}
                    </div>
                    <Badge variant={s.variant} className="shrink-0">{s.label}</Badge>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.length === 0 && <p className="text-sm text-muted-foreground">{t('noApprovals')}</p>}
          {approvals.map(a => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{a.action_type}</CardTitle>
                    <Badge variant={a.risk_level === 'high' ? 'destructive' : a.risk_level === 'medium' ? 'warning' : 'secondary'}>
                      {t('riskLevel', { level: a.risk_level })}
                    </Badge>
                  </div>
                  <CardDescription>{a.role_id} · {new Date(a.requested_at).toLocaleString(dateLocale)}</CardDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="destructive" disabled={busy === a.id} onClick={() => respondApproval(a.id, 'reject')}>
                    <XCircle className="h-4 w-4" />{t('reject')}
                  </Button>
                  <Button size="sm" disabled={busy === a.id} onClick={() => respondApproval(a.id, 'approve')}>
                    <CheckCircle2 className="h-4 w-4" />{t('approve')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{a.summary}</p>
              </CardContent>
            </Card>
          ))}
          {approvals.length > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('approvalHint')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
