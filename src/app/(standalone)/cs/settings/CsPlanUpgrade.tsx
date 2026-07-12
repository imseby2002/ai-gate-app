'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { CS_FEATURE_REQUEST_PRICING } from '@/lib/cs/entitlements'

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
    features: ['包含 PRO 全部功能', '無限協作人員', '每月 1 次免費協助設定'],
  },
  {
    plan: 'enterprise', name: '企業', monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly', monthlyUsd: 41, yearlyUsd: 399,
    features: ['包含 TEAM 全部功能', '不限平台數', '報價計算機', '每月 2 次免費協助設定'],
  },
]

// 功能比較表：每一列對應一個功能，四欄分別是免費／PRO／TEAM／企業的值
const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: '平台串接數', values: ['1 個', '3 個', '3 個', '不限'] },
  { label: '客服訊息則數', values: ['不限', '不限', '不限', '不限'] },
  { label: '協作人員', values: ['不可邀請', '1 位', '無限', '無限'] },
  { label: 'AI 設定', values: ['基本', '完整', '完整', '完整'] },
  { label: 'Claude 風險升級', values: ['—', '✓', '✓', '✓'] },
  { label: '資料來源管理', values: ['—', '✓', '✓', '✓'] },
  { label: '工單系統', values: ['—', '✓', '✓', '✓'] },
  { label: '統一收件匣', values: ['—', '✓', '✓', '✓'] },
  { label: '自動學習', values: ['—', '✓', '✓', '✓'] },
  { label: '報價計算機', values: ['—', '—', '—', '✓'] },
  { label: '協助設定（免費額度／月）', values: ['0（$25/次）', '0（$15/次）', '1 次', '2 次'] },
]

export function CsPlanUpgrade() {
  const [plan, setPlan] = useState<CsPlan | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
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
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">CS 方案</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            目前：{plan === 'free' ? '免費' : plan.toUpperCase()}
          </span>
          <a href="/settings" className="text-xs text-primary font-medium hover:underline">
            儲值點數 →
          </a>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setCycle('yearly')}
            className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            年繳（約 8 折）
          </button>
          <button onClick={() => setCycle('monthly')}
            className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            月繳
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_CARDS.map(c => {
          const isCurrent = plan === c.plan
          const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
          const yearlyMonthlyEquiv = c.yearlyUsd / 12
          const savingsPct = Math.round((1 - c.yearlyUsd / (c.monthlyUsd * 12)) * 100)
          return (
            <div key={c.plan} className={`rounded-xl border p-4 space-y-2 ${isCurrent ? 'border-primary bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{c.name}</span>
                {isCurrent && <span className="text-[10px] flex items-center gap-1 text-primary"><Check className="h-3 w-3" />使用中</span>}
              </div>
              {cycle === 'monthly' ? (
                <div className="text-lg font-bold">
                  ${c.monthlyUsd} <span className="text-xs font-normal text-muted-foreground">美元/月</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs line-through text-muted-foreground">${c.monthlyUsd}</span>
                    <span className="text-lg font-bold">${yearlyMonthlyEquiv.toFixed(2)}</span>
                    <span className="text-xs font-normal text-muted-foreground">美元/月</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">省 {savingsPct}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">年繳 ${c.yearlyUsd} 美元</div>
                </div>
              )}
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

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[11px] border-collapse min-w-[480px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium py-1.5 px-1">功能比較</th>
              <th className="text-center font-medium py-1.5 px-1">免費</th>
              <th className="text-center font-medium py-1.5 px-1">PRO</th>
              <th className="text-center font-medium py-1.5 px-1">TEAM</th>
              <th className="text-center font-medium py-1.5 px-1">企業</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(row => (
              <tr key={row.label} className="border-t">
                <td className="text-left py-1.5 px-1 text-muted-foreground">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="text-center py-1.5 px-1">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground border-t pt-2">
        「協助設定」與「客製功能」不同：協助設定僅協助頻道串接與參數設定，依方案有免費額度；
        客製功能是提供方案本身沒有的功能或需要改寫程式——
        基礎客製固定 ${CS_FEATURE_REQUEST_PRICING.basicPriceUsd}/次（{CS_FEATURE_REQUEST_PRICING.basicNote}），
        進階或複雜功能{CS_FEATURE_REQUEST_PRICING.advancedNote}。
      </p>
    </div>
  )
}
