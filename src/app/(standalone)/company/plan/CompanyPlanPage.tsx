'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Sparkles, Loader2, Lock, Building2 } from 'lucide-react'

// 等級名稱在所有語言都固定用 FREE / CORE / PRO / MAX
type CompanyPlan = 'free' | 'core' | 'pro' | 'max'
type Cycle = 'monthly' | 'yearly'

const PLAN_NAME: Record<CompanyPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', max: 'MAX' }

const PLAN_META = [
  { id: 'free' as CompanyPlan, monthlyUsd: 0, yearlyUsd: 0, highlight: false, monthlyId: undefined as string | undefined, yearlyId: undefined as string | undefined,
    freeQuota: 0 },
  { id: 'core' as CompanyPlan, monthlyUsd: 19, yearlyUsd: 190, highlight: false, monthlyId: 'core_monthly', yearlyId: 'core_yearly',
    freeQuota: 1 },
  { id: 'pro' as CompanyPlan, monthlyUsd: 39, yearlyUsd: 390, highlight: true, monthlyId: 'pro_monthly', yearlyId: 'pro_yearly',
    freeQuota: 3 },
  { id: 'max' as CompanyPlan, monthlyUsd: 79, yearlyUsd: 790, highlight: false, monthlyId: 'max_monthly', yearlyId: 'max_yearly',
    freeQuota: 10 },
]

export function CompanyPlanPage({ isOwnerOrAdmin }: { isOwnerOrAdmin: boolean }) {
  const [plan, setPlan] = useState<CompanyPlan | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/company/plan')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '載入失敗'); return }
      setPlan(data.plan ?? 'free')
      setCompanyName(data.companyName ?? '')
    } catch { setPlan('free') }
  }, [])

  useEffect(() => { load() }, [load])

  const upgrade = async (packageId: string) => {
    setCheckingOut(packageId)
    setError('')
    try {
      const res = await fetch('/api/billing/create-company-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '建立訂單失敗'); return }

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
      setError('網路錯誤，請稍後再試')
    } finally {
      setCheckingOut(null)
    }
  }

  if (plan == null) return <div className="p-6 text-muted-foreground text-sm">載入中…</div>

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-16 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
            <Building2 className="h-5 w-5 shrink-0" />
            {companyName || '公司'} · 會員方案
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            升級後，公司每月的「功能新增/調整」意見反映需求會有免費額度，超過才需要審核計費。
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">訂閱方案</h1>
            <p className="text-sm text-muted-foreground mt-0.5">依需求選擇適合的每月免費功能修改次數，隨時可升級</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              目前：{PLAN_NAME[plan]}
            </span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setCycle('yearly')}
                className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                年繳（約省 2 個月）
              </button>
              <button onClick={() => setCycle('monthly')}
                className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                月繳
              </button>
            </div>
          </div>
        </div>

        {!isOwnerOrAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>方案升級需由<strong>公司負責人或管理員</strong>操作。</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

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
                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium"><Check className="h-3 w-3" />使用中</span>
                  ) : c.highlight && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                      <Sparkles className="h-3 w-3" />推薦
                    </span>
                  )}
                </div>

                {isFree ? (
                  <div className="text-2xl font-bold text-foreground">$0</div>
                ) : cycle === 'monthly' ? (
                  <div className="text-2xl font-bold text-foreground">
                    ${c.monthlyUsd} <span className="text-xs font-normal text-muted-foreground">美元/月</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs line-through text-muted-foreground">${c.monthlyUsd}</span>
                      <span className="text-2xl font-bold text-foreground">${yearlyMonthlyEquiv.toFixed(2)}</span>
                      <span className="text-xs font-normal text-muted-foreground">美元/月</span>
                      {savingsPct > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">省 {savingsPct}%</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">年繳 ${c.yearlyUsd} 美元</div>
                  </div>
                )}

                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <span>每月免費功能修改 {c.freeQuota} 次</span>
                  </li>
                </ul>

                {!isFree && (
                  <button
                    onClick={() => upgrade(packageId!)}
                    disabled={!isOwnerOrAdmin || isCurrent || checkingOut === packageId}
                    className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {checkingOut === packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isCurrent ? '目前方案' : '升級'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">付款後方案立即生效；到期前不會自動續訂，需自行再次購買延續。</p>
      </div>
    </div>
  )
}
