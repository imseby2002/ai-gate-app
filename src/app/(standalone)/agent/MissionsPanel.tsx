'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Target, Loader2, Sparkles, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface EnabledRole { id: string; label: string }

interface MissionKpi { key: string; name: string; target: number; unit: string; current?: number | null }

interface MissionListItem {
  id: string
  role_id: string
  objective: string
  budget_amount: number
  budget_currency: string
  budget_spent: number
  status: string
  kpis: MissionKpi[]
  created_at: string
  last_error: string | null
}

export const MISSION_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  planning: 'secondary',
  plan_ready: 'warning',
  executing: 'default',
  paused: 'destructive',
  completed: 'success',
  cancelled: 'secondary',
  failed: 'destructive',
}

const CURRENCIES = ['TWD', 'VND', 'USD']

export default function MissionsPanel({ roles }: { roles: EnabledRole[] }) {
  const t = useTranslations('AgentMission')
  const locale = useLocale()
  const router = useRouter()
  const dateLocale = locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW'

  const [missions, setMissions] = useState<MissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleId, setRoleId] = useState('')
  const [objective, setObjective] = useState('')
  const [budget, setBudget] = useState('0')
  const [currency, setCurrency] = useState(locale === 'vi' ? 'VND' : 'TWD')
  const [deadline, setDeadline] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/agent/missions').then(r => r.json()).catch(() => ({}))
    setMissions(res.missions ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // 未手動選擇時預設「網路行銷專員」，沒啟用就用第一個已啟用角色
  const selectedRoleId = roleId || roles.find(r => r.id === 'digital-marketer')?.id || roles[0]?.id || ''

  const create = async () => {
    if (!selectedRoleId || !objective.trim()) return
    setCreating(true)
    setError(null)
    const res = await fetch('/api/agent/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: selectedRoleId, objective: objective.trim(), budgetAmount: Number(budget) || 0, budgetCurrency: currency, deadline: deadline || null }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)
    const id = data.mission?.id ?? data.missionId
    if (!res.ok) setError(data.error ?? t('planFailed'))
    if (id) router.push(`/agent/missions/${id}`)
    else load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />{t('newTitle')}</CardTitle>
          <CardDescription>{t('newDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noEnabledRoles')}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="text-muted-foreground">{t('role')}</span>
                  <select
                    value={selectedRoleId}
                    onChange={e => setRoleId(e.target.value)}
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-muted-foreground">{t('budget')}</span>
                  <div className="flex gap-1">
                    <Input type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)} />
                    <select
                      aria-label={t('currency')}
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="h-9 rounded-md border bg-background px-1 text-sm"
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-muted-foreground">{t('deadline')}</span>
                  <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </label>
              </div>
              <label className="text-sm space-y-1 block">
                <span className="text-muted-foreground">{t('objective')}</span>
                <Textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder={t('objectivePlaceholder')}
                  className="min-h-[80px]"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button disabled={creating || !objective.trim() || !selectedRoleId} onClick={create}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {creating ? t('generating') : t('generatePlan')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : missions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noMissions')}</p>
      ) : (
        missions.map(m => {
          const kpiDone = (m.kpis ?? []).filter(k => k.current != null)
          return (
            <Link key={m.id} href={`/agent/missions/${m.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer mb-3">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-sm line-clamp-2">{m.objective}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {new Date(m.created_at).toLocaleString(dateLocale)}
                      <span>· {m.role_id}</span>
                      <span>· {t('spentOf', { spent: m.budget_spent, total: m.budget_amount, currency: m.budget_currency })}</span>
                      {kpiDone.map(k => (
                        <span key={k.key}>· {k.name} {k.current}/{k.target}</span>
                      ))}
                    </div>
                    {m.last_error && <div className="text-xs text-destructive mt-1">{m.last_error}</div>}
                  </div>
                  <Badge variant={MISSION_STATUS_VARIANT[m.status] ?? 'secondary'} className="shrink-0">
                    {t(`status_${m.status}`)}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          )
        })
      )}
    </div>
  )
}
