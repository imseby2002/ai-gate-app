'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, Sparkles } from 'lucide-react'

type CsPlan = 'free' | 'pro' | 'team' | 'enterprise'
type Cycle = 'monthly' | 'yearly'

const PLAN_CARDS: Array<{
  plan: Exclude<CsPlan, 'free'>
  name: string
  monthlyId: string
  yearlyId: string
  monthlyUsd: number
  yearlyUsd: number
  features: string[]
}> = [
  {
    plan: 'pro', name: 'PRO', monthlyId: 'pro_monthly', yearlyId: 'pro_yearly', monthlyUsd: 19, yearlyUsd: 182,
    features: ['Claude 風險升級', '3 個平台串接', 'AI 設定全開', '資料來源／工單／收件匣'],
  },
  {
    plan: 'team', name: 'TEAM', monthlyId: 'team_monthly', yearlyId: 'team_yearly', monthlyUsd: 29, yearlyUsd: 278,
    features: ['包含 PRO 全部功能', '無限協作人員', '每月 1 次免費協助設定', '每月 1 次基本客製功能'],
  },
  {
    plan: 'enterprise', name: '企業', monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly', monthlyUsd: 41, yearlyUsd: 399,
    features: ['包含 TEAM 全部功能', '不限平台數', '報價計算機', '每月 2 次免費協助設定'],
  },
]

export function CsPlanUpgrade() {
  const [plan, setPlan] = useState<CsPlan | null>(null)
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/cs-plan')
      const data = await res.json()
      setPlan(data.plan ?? 'free')
    } catch { setPlan('free') }
  }, [])

  useEffect(() => { load() }, [load])

  const upgrade = async (packageId: string) => {
    setCheckingOut(packageId)
    try {
      const res = await fetch('/api/billing/create-cs-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '建立訂單失敗'); return }

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
      alert('網路錯誤，請稍後再試')
    } finally {
      setCheckingOut(null)
    }
  }

  if (plan == null) return null

  return (
    <div className="mb-5 rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">CS 方案</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            目前：{plan === 'free' ? '免費' : plan.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setCycle('monthly')}
            className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            月繳
          </button>
          <button onClick={() => setCycle('yearly')}
            className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            年繳（約 8 折）
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_CARDS.map(c => {
          const isCurrent = plan === c.plan
          const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
          const price = cycle === 'monthly' ? c.monthlyUsd : c.yearlyUsd
          return (
            <div key={c.plan} className={`rounded-xl border p-4 space-y-2 ${isCurrent ? 'border-primary bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{c.name}</span>
                {isCurrent && <span className="text-[10px] flex items-center gap-1 text-primary"><Check className="h-3 w-3" />使用中</span>}
              </div>
              <div className="text-lg font-bold">
                ${price} <span className="text-xs font-normal text-muted-foreground">美元/{cycle === 'monthly' ? '月' : '年'}</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1">
                {c.features.map(f => <li key={f}>· {f}</li>)}
              </ul>
              <button
                onClick={() => upgrade(packageId)}
                disabled={isCurrent || checkingOut === packageId}
                className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-primary-foreground bg-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {checkingOut === packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {isCurrent ? '目前方案' : '升級'}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">付款後方案立即生效，到期前不會自動續訂，需自行再次購買延續。</p>
    </div>
  )
}
