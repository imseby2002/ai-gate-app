'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, Sparkles, Gift } from 'lucide-react'
import { PLAN_CARDS, COMPARISON_ROWS } from '@/lib/marketing/plan-compare'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

type MarketingPlan = 'free' | 'pro' | 'team' | 'enterprise'
type Cycle = 'monthly' | 'yearly'
type MonthlyGift = { planAllowance: number; allowance: number; remaining: number; emailVerified: boolean }

export function MarketingPlanUpgrade() {
  const t = useTranslations('MktPlan')
  const pc = useTranslations('PlanCompare')
  // 比較表儲存格：有翻譯就用翻譯（✓／— 等符號不翻）
  const tv = (v: string) => (pc.has(`val.${v}`) ? pc(`val.${v}`) : v)
  const [plan, setPlan] = useState<MarketingPlan | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [gift, setGift] = useState<MonthlyGift | null>(null)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/plan')
      const data = await res.json()
      setPlan(data.plan ?? 'free')
      setGift(data.monthlyGift ?? null)
    } catch { setPlan('free') }
  }, [])

  useEffect(() => { load() }, [load])

  const upgrade = async (packageId: string) => {
    setCheckingOut(packageId)
    try {
      const res = await fetch('/api/billing/create-marketing-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? t('orderFailed')); return }

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
    } catch {
      alert(t('netErr'))
    } finally {
      setCheckingOut(null)
    }
  }

  // FREE 需 Email 驗證才發放每月贈點：重寄註冊驗證信
  const resendVerification = async () => {
    setResend('sending')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('no email')
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      })
      setResend(error ? 'error' : 'sent')
    } catch {
      setResend('error')
    }
  }

  if (plan == null) return null

  return (
    <div className="mb-5 rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">{t('title')}</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {t('current', { plan: ({ free: t('free'), pro: 'CORE', team: 'PRO', enterprise: 'MAX' } as Record<MarketingPlan, string>)[plan] })}
          </span>
          <a href="/settings" className="text-sm text-primary font-medium hover:underline">
            {t('topUp')}
          </a>
        </div>
        <div className="flex gap-1 text-sm">
          <button onClick={() => setCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg font-medium ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            {t('yearly')}
          </button>
          <button onClick={() => setCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg font-medium ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            {t('monthly')}
          </button>
        </div>
      </div>

      {gift && gift.planAllowance > 0 && (gift.allowance > 0 || !gift.emailVerified) && (
        <div className="flex items-center gap-2.5 flex-wrap rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <Gift className="h-4 w-4 text-primary shrink-0" />
          {gift.allowance > 0 ? (
            <span>
              {t.rich('giftLeft', { r: gift.remaining.toFixed(2), a: gift.allowance, b: c => <span className="font-semibold">{c}</span> })}
              <span className="text-muted-foreground">{t('giftNote')}</span>
            </span>
          ) : (
            <>
              <span>{t('verifyForGift', { n: gift.planAllowance })}</span>
              <button
                onClick={resendVerification}
                disabled={resend === 'sending' || resend === 'sent'}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-primary-foreground bg-primary disabled:opacity-50 flex items-center gap-1"
              >
                {resend === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {resend === 'sent' ? t('sent') : t('resend')}
              </button>
              {resend === 'error' && <span className="text-xs text-red-600">{t('sendFailed')}</span>}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_CARDS.map(c => {
          const isCurrent = plan === c.plan
          const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
          const yearlyMonthlyEquiv = c.yearlyUsd / 12
          const savingsPct = Math.round((1 - c.yearlyUsd / (c.monthlyUsd * 12)) * 100)
          return (
            <div key={c.plan} className={`rounded-xl border p-5 space-y-3 ${isCurrent ? 'border-primary bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">{c.name}</span>
                {isCurrent && <span className="text-xs flex items-center gap-1 text-primary font-medium"><Check className="h-3.5 w-3.5" />{t('inUse')}</span>}
              </div>
              {cycle === 'monthly' ? (
                <div className="text-2xl font-bold">
                  ${c.monthlyUsd} <span className="text-sm font-normal text-muted-foreground">{t('perMonth')}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm line-through text-muted-foreground">${c.monthlyUsd}</span>
                    <span className="text-2xl font-bold">${yearlyMonthlyEquiv.toFixed(2)}</span>
                    <span className="text-sm font-normal text-muted-foreground">{t('perMonth')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{t('save', { n: savingsPct })}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{t('yearlyTotal', { n: c.yearlyUsd })}</div>
                </div>
              )}
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {c.features.map((f, i) => <li key={f}>· {pc.has(`feat.${c.plan}.f${i}`) ? pc(`feat.${c.plan}.f${i}`) : f}</li>)}
              </ul>
              <button
                onClick={() => upgrade(packageId)}
                disabled={isCurrent || checkingOut === packageId}
                className="w-full mt-1 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {checkingOut === packageId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCurrent ? t('currentPlan') : t('upgrade')}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('footnote')}</p>

      <div>
        <h3 className="text-sm font-semibold mb-2">{t('compare')}</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="text-left font-medium py-2.5 px-3">{t('feature')}</th>
                <th className="text-center font-medium py-2.5 px-3">{t('free')}</th>
                <th className="text-center font-medium py-2.5 px-3">CORE</th>
                <th className="text-center font-medium py-2.5 px-3">PRO</th>
                <th className="text-center font-medium py-2.5 px-3">MAX</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.label} className={`border-t ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                  <td className="text-left py-2.5 px-3 text-muted-foreground whitespace-nowrap">{pc.has(`rows.r${i}`) ? pc(`rows.r${i}`) : row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className="text-center py-2.5 px-3 font-medium">{tv(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
