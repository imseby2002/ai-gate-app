'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Lock, Building2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { YEARLY_MONTHS, COMPANY_MONTHLY_GIFT_USD, type CompanyPriceLine } from '@/lib/company/pricing'
import { CREDIT_PACKAGES } from '@/lib/ecpay/client'

type Cycle = 'monthly' | 'yearly'

interface PlanData {
  plan: string
  companyName: string
  currentPeriodEnd: string | null
  price: { lines: CompanyPriceLine[]; monthlyUsd: number }
  wallet: { gift: number; paid: number }
  canTopUp: boolean
  enterprise: boolean
}

// 公司方案為模組化計價：開通內容（模組、ERP 人數、門市數、自訂網域）由平台設定，
// 公司在這裡確認明細並付款。價格計算見 lib/company/pricing.ts。
export function CompanyPlanPage({ isOwnerOrAdmin }: { isOwnerOrAdmin: boolean }) {
  const t = useTranslations('CompanyPlan')
  const locale = useLocale()
  const [data, setData] = useState<PlanData | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/company/plan')
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? t('loadFailed')); return }
      setData(d)
    } catch { setError(t('networkError')) }
  }, [])

  useEffect(() => { load() }, [load])

  const [toppingUp, setToppingUp] = useState<string | null>(null)

  const pay = () => startCheckout('/api/billing/create-company-plan-checkout', { cycle }, setCheckingOut)
  const topUp = (packageId: string) =>
    startCheckout('/api/billing/create-company-credit-checkout', { packageId }, busy => setToppingUp(busy ? packageId : null))

  // 建立綠界訂單後以隱藏表單送出（另開分頁付款）
  const startCheckout = async (url: string, body: Record<string, unknown>, setBusy: (busy: boolean) => void) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, returnUrl: window.location.href }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? t('orderFailed')); return }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = d.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(d.params as Record<string, string>)) {
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
      setError(t('networkError'))
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground text-sm">{error || t('loading')}</div>
  }

  const active = data.plan === 'company'
  const monthly = data.price.monthlyUsd
  const total = cycle === 'yearly' ? monthly * YEARLY_MONTHS : monthly
  const endDate = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString(locale) : null

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-16 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
            <Building2 className="h-5 w-5 shrink-0" />
            {data.companyName || t('company')} · {data.enterprise ? t('enterpriseFull') : t('companyPlan')}
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            {data.enterprise
              ? t('enterpriseDesc')
              : t('companyDesc')}
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            {active
              ? <span className="flex items-center gap-1 text-green-600 font-medium"><Check className="h-4 w-4" />{t('inUse', { plan: data.enterprise ? t('enterprise') : t('companyPlan') })}{endDate ? t('expires', { date: endDate }) : ''}</span>
              : <span className="text-muted-foreground">{t('notActive')}</span>}
          </div>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setCycle('yearly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              {t('yearly', { n: YEARLY_MONTHS })}
            </button>
            <button onClick={() => setCycle('monthly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              {t('monthly')}
            </button>
          </div>
        </div>

        {!isOwnerOrAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t.rich('payNeedsAdmin', { b: chunks => <strong>{chunks}</strong> })}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
          <div className="font-semibold text-foreground">{t('priceBreakdown')}</div>
          {data.price.lines.map(l => (
            <div key={l.label} className="flex justify-between text-muted-foreground tabular-nums">
              <span>{l.key && t.has(`line.${l.key}`) ? t(`line.${l.key}`, l.params ?? {}) : l.label}</span><span>${l.usd}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-bold text-foreground tabular-nums">
            <span>{cycle === 'yearly' ? t('yearlyTotal', { m: monthly, n: YEARLY_MONTHS }) : t('monthlyTotal')}</span>
            <span>${total}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('contractNote')}</p>
        </div>

        {data.enterprise ? (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="font-semibold text-foreground">{t('credits')}</div>
            <p className="text-muted-foreground mt-1">{t('enterpriseCredits')}</p>
          </div>
        ) : (
        <div className="rounded-xl border bg-card p-4 space-y-1 text-sm">
          <div className="font-semibold text-foreground">{t('wallet')}</div>
          <div className="flex justify-between text-muted-foreground tabular-nums"><span>{t('monthlyGift', { n: COMPANY_MONTHLY_GIFT_USD })}</span><span>${data.wallet.gift.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground tabular-nums"><span>{t('paidBalance')}</span><span>${data.wallet.paid.toFixed(2)}</span></div>
          <p className="text-[11px] text-muted-foreground">{t('deductOrder')}</p>
          {data.canTopUp && active ? (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {CREDIT_PACKAGES.map(pkg => (
                <button key={pkg.id} onClick={() => topUp(pkg.id)} disabled={toppingUp !== null}
                  className="rounded-lg border px-2 py-2 text-xs hover:bg-muted disabled:opacity-40 flex flex-col items-center gap-0.5">
                  {toppingUp === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="font-semibold text-foreground">{t('topUp', { label: pkg.label })}</span>}
                  <span className="text-muted-foreground">{t('getsCredits', { n: pkg.usdCredit })}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground pt-1">
              {active ? t('topUpWho') : t('topUpAfterActive')}
            </p>
          )}
        </div>
        )}

        <button
          onClick={pay}
          disabled={!isOwnerOrAdmin || checkingOut}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('payBtn', { action: active ? t('renew') : t('activate'), total })}
        </button>

        <p className="text-[11px] text-muted-foreground">{t('payNote')}</p>
      </div>
    </div>
  )
}
