'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Sparkles, Loader2, Lock, RefreshCw } from 'lucide-react'
import { CS_FEATURE_REQUEST_PRICING, type CsPlanFeatures } from '@/lib/cs/entitlements'
import { CsSideNav } from '../CsSideNav'

// 等級名稱在所有語言都固定用 FREE / CORE / PRO / MAX
type CsPlan = 'free' | 'core' | 'pro' | 'max'
type Cycle = 'monthly' | 'yearly'

const PLAN_NAME: Record<CsPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', max: 'MAX' }

const getPlanMeta = (t: (key: string) => string) => [
  { id: 'free' as CsPlan, monthlyUsd: 0, yearlyUsd: 0, highlight: false, monthlyId: undefined as string | undefined, yearlyId: undefined as string | undefined,
    features: [t('featFree1'), t('featFree2'), t('featFree3')] },
  { id: 'core' as CsPlan, monthlyUsd: 19, yearlyUsd: 182, highlight: true, monthlyId: 'core_monthly', yearlyId: 'core_yearly',
    features: [t('featCore1'), t('featCore2'), t('featCore3'), t('featCore4')] },
  { id: 'pro' as CsPlan, monthlyUsd: 29, yearlyUsd: 278, highlight: false, monthlyId: 'pro_monthly', yearlyId: 'pro_yearly',
    features: [t('featPro1'), t('featPro2'), t('featPro3'), t('featPro4')] },
  { id: 'max' as CsPlan, monthlyUsd: 41, yearlyUsd: 399, highlight: false, monthlyId: 'max_monthly', yearlyId: 'max_yearly',
    features: [t('featMax1'), t('featMax2'), t('featMax3'), t('featMax4')] },
]

// 功能比較表：四欄方案值（免費／PRO／TEAM／企業）＋ market（市場常見模式，用來對比痛點）
const getComparisonRows = (t: (key: string) => string): Array<{ label: string; values: [string, string, string, string]; market: string }> => [
  { label: t('rowMessages'), values: [t('unlimited'), t('unlimited'), t('unlimited'), t('unlimited')], market: t('marketMessages') },
  { label: t('rowPlatformCount'), values: [t('threeItems'), t('threeItems'), t('threeItems'), t('unlimited')], market: t('marketPlatformCount') },
  { label: t('rowWhatsapp'), values: ['—', '✓', '✓', '✓'], market: t('marketMostUnsupported') },
  { label: t('rowKnowledgeBase'), values: ['✓', '✓', '✓', '✓'], market: t('marketOftenAddon') },
  { label: t('rowCollaborators'), values: [t('cantInvite'), t('oneSeat'), t('fiveSeats'), t('unlimitedSeats')], market: t('marketPerSeat') },
  { label: t('rowAiSettings'), values: [t('basic'), t('full'), t('full'), t('full')], market: t('marketBasicVersion') },
  { label: t('rowClaudeEscalation'), values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: t('rowComplexCs'), values: ['—', '✓', '✓', '✓'], market: t('marketMostUnsupported') },
  { label: t('rowDataSources'), values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: t('rowTickets'), values: ['—', '✓', '✓', '✓'], market: t('marketOftenAddon') },
  { label: t('rowInbox'), values: ['—', '✓', '✓', '✓'], market: t('marketOftenAddon') },
  { label: t('rowAutoLearning'), values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: t('rowWebSearch'), values: ['—', '—', '✓', '✓'], market: t('marketMostUnsupported') },
  { label: t('rowPricingCalc'), values: ['—', '—', '—', '✓'], market: '—' },
  { label: t('rowSetupHelp'), values: [t('setupHelpFree0'), t('setupHelpCore0'), t('setupHelp1x'), t('setupHelp2x')], market: t('marketConsultingFee') },
]

export function CsPlanPage({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations('CsPlanPage')
  const PLAN_META = getPlanMeta(t)
  const COMPARISON_ROWS = getComparisonRows(t)
  const [plan, setPlan] = useState<CsPlan | null>(null)
  const [features, setFeatures] = useState<CsPlanFeatures | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [autoRenewPkg, setAutoRenewPkg] = useState<Record<string, boolean>>({})
  const [recurringOrders, setRecurringOrders] = useState<Array<{ id: string; reference_id: string; usd_value: number; status: string; total_success_times: number }>>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/cs-plan')
      const data = await res.json()
      setPlan(data.plan ?? 'free')
      setFeatures(data.features ?? null)
    } catch { setPlan('free') }
  }, [])

  const loadRecurringOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/cancel-recurring')
      const data = await res.json()
      if (res.ok) setRecurringOrders((data.orders ?? []).filter((o: { kind: string }) => o.kind === 'cs_plan'))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load(); loadRecurringOrders() }, [load, loadRecurringOrders])

  const handleCancelRecurring = async (orderId: string) => {
    if (!confirm(t('confirmCancelRecurring'))) return
    setCancellingId(orderId)
    try {
      const res = await fetch('/api/billing/cancel-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadRecurringOrders()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('cancelFailed'))
    } finally {
      setCancellingId(null)
    }
  }

  const upgrade = async (packageId: string) => {
    setCheckingOut(packageId)
    try {
      const res = await fetch('/api/billing/create-cs-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl: window.location.href, autoRenew: !!autoRenewPkg[packageId] }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? t('createOrderFailed')); return }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(data.params as Record<string, string>)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
      if (autoRenewPkg[packageId]) setTimeout(loadRecurringOrders, 3000)
    } catch {
      alert(t('networkError'))
    } finally {
      setCheckingOut(null)
    }
  }

  if (plan == null) return <div className="p-6 text-muted-foreground text-sm">{t('loading')}</div>

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-16 flex flex-col sm:flex-row gap-5 items-start">
        <CsSideNav active="plan" features={features} />
        <div className="flex-1 min-w-0 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
            <Sparkles className="h-5 w-5 shrink-0" />
            {t('bannerTitle')}
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            {t('bannerDesc')}
          </p>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('pageTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('pageDesc')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {t('currentPlanLabel')}{PLAN_NAME[plan]}
            </span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setCycle('yearly')}
                className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                {t('yearlyBilling')}
              </button>
              <button onClick={() => setCycle('monthly')}
                className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                {t('monthlyBilling')}
              </button>
            </div>
          </div>
        </div>

        {!isOwner && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t.rich('ownerOnlyNotice', { b: (chunks) => <strong>{chunks}</strong> })}</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 px-4 py-3">
          <span className="text-xl shrink-0">🎁</span>
          <p className="text-sm text-amber-900 dark:text-amber-200 font-medium">
            {t('coreUpgradeGiftHint')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_META.map(c => {
            const isCurrent = plan === c.id
            const isFree = c.id === 'free'
            const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
            const yearlyMonthlyEquiv = c.yearlyUsd / 12
            const savingsPct = c.monthlyUsd > 0 ? Math.round((1 - c.yearlyUsd / (c.monthlyUsd * 12)) * 100) : 0

            return (
              <div key={c.id}
                className={`rounded-xl border bg-card p-4 space-y-3 ${c.highlight ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''} ${isCurrent ? 'ring-1 ring-green-500 border-green-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{PLAN_NAME[c.id]}</span>
                  {isCurrent ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium"><Check className="h-3 w-3" />{t('inUse')}</span>
                  ) : c.highlight && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                      <Sparkles className="h-3 w-3" />{t('recommended')}
                    </span>
                  )}
                </div>

                {isFree ? (
                  <div className="text-2xl font-bold text-foreground">$0</div>
                ) : cycle === 'monthly' ? (
                  <div className="text-2xl font-bold text-foreground">
                    ${c.monthlyUsd} <span className="text-xs font-normal text-muted-foreground">{t('usdPerMonth')}</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs line-through text-muted-foreground">${c.monthlyUsd}</span>
                      <span className="text-2xl font-bold text-foreground">${yearlyMonthlyEquiv.toFixed(2)}</span>
                      <span className="text-xs font-normal text-muted-foreground">{t('usdPerMonth')}</span>
                      {savingsPct > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{t('savePct', { n: savingsPct })}</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t('yearlyUsdTotal', { n: c.yearlyUsd })}</div>
                  </div>
                )}

                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {c.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {!isFree && (
                  <>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!autoRenewPkg[packageId ?? '']}
                        onChange={e => setAutoRenewPkg(prev => ({ ...prev, [packageId ?? '']: e.target.checked }))}
                        className="rounded"
                      />
                      {cycle === 'yearly' ? t('autoRenewYearly') : t('autoRenewMonthly')}
                    </label>
                    <button
                      onClick={() => upgrade(packageId!)}
                      disabled={!isOwner || isCurrent || checkingOut === packageId}
                      className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {checkingOut === packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {isCurrent ? t('currentPlanButton') : t('upgradeButton')}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {recurringOrders.length > 0 && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> {t('autoRenewingTitle')}
            </div>
            {recurringOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <div className="font-medium text-foreground">
                    {o.reference_id}<span className="ml-2 text-muted-foreground">{t('usdPerMonthValue', { n: o.usd_value })}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {o.status === 'pending' ? t('pendingFirstCharge') : t('chargedNTimes', { n: o.total_success_times })}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelRecurring(o.id)}
                  disabled={cancellingId === o.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-accent disabled:opacity-50"
                >
                  {cancellingId === o.id ? t('cancelling') : t('cancelAutoRenew')}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{t('paymentEffectiveHint')}</p>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left font-medium py-2.5 px-3 text-muted-foreground">{t('featureColLabel')}</th>
                {(['free', 'core', 'pro', 'max'] as CsPlan[]).map(id => (
                  <th key={id} className="text-center font-medium py-2.5 px-3 text-muted-foreground">{PLAN_NAME[id]}</th>
                ))}
                <th className="text-center font-semibold py-2.5 px-3 text-white bg-amber-800 whitespace-nowrap">{t('marketPatternColLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(row => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="text-left py-2.5 px-3 text-muted-foreground whitespace-nowrap">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="text-center py-2.5 px-3 text-foreground">
                      {v === '✓' ? <Check className="h-3.5 w-3.5 mx-auto text-primary" /> : v === '—' ? <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/40" /> : v}
                    </td>
                  ))}
                  <td className="text-center py-2.5 px-3 text-xs text-white bg-amber-700/90">
                    {row.market}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground space-y-2">
          <p>
            {t('customFeatureExplain', {
              freePrice: CS_FEATURE_REQUEST_PRICING.basicPriceUsdByPlan.free,
              corePrice: CS_FEATURE_REQUEST_PRICING.basicPriceUsdByPlan.core,
              basicNote: CS_FEATURE_REQUEST_PRICING.basicNote,
              complexNote: CS_FEATURE_REQUEST_PRICING.complexNote,
            })}
          </p>
          <p>{CS_FEATURE_REQUEST_PRICING.clawbackNote}。</p>
          <p>
            {t('setupHelpScopeNote')}
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
