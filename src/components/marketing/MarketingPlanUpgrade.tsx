'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, Sparkles } from 'lucide-react'

type MarketingPlan = 'free' | 'pro' | 'team' | 'enterprise'
type Cycle = 'monthly' | 'yearly'

const PLAN_CARDS: Array<{
  plan: Exclude<MarketingPlan, 'free'>
  name: string
  monthlyId: string
  yearlyId: string
  monthlyUsd: number
  yearlyUsd: number
  features: string[]
}> = [
  {
    plan: 'pro', name: 'PRO', monthlyId: 'pro_monthly', yearlyId: 'pro_yearly', monthlyUsd: 29, yearlyUsd: 278,
    features: ['10 個行銷案', '圖片產出＋自動上傳平台', 'AI 產品行銷設計師（策略＋文案）', 'GEO 產文無限', 'Email 行銷'],
  },
  {
    plan: 'team', name: 'TEAM', monthlyId: 'team_monthly', yearlyId: 'team_yearly', monthlyUsd: 49, yearlyUsd: 470,
    features: ['包含 PRO 全部功能', '行銷案無上限', '影片產出＋AI 電訪', 'AI 視覺工坊', '行銷流水線', '可建立自製專家'],
  },
  {
    plan: 'enterprise', name: '企業', monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly', monthlyUsd: 79, yearlyUsd: 758,
    features: ['包含 TEAM 全部功能', '主播行銷（HeyGen）', 'AI 視覺工坊全節點', '企業客製功能'],
  },
]

// 功能比較表：每一列對應一個功能，四欄分別是免費／PRO／TEAM／企業的值
const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: '行銷案數', values: ['1 個', '10 個', '無限', '無限'] },
  { label: '協作人員', values: ['不可邀請', '1 位', '無限', '無限'] },
  { label: '資料蒐集／分析／文案', values: ['基本', '✓', '✓', '✓'] },
  { label: '圖片產出（點數扣款）', values: ['—', '✓', '✓', '✓'] },
  { label: '自動上傳平台', values: ['—', '✓', '✓', '✓'] },
  { label: '影片產出（點數扣款）', values: ['—', '—', '✓', '✓'] },
  { label: 'AI 電訪＋Email（點數扣款）', values: ['—', 'Email', '✓', '✓'] },
  { label: '主播行銷 HeyGen（點數扣款）', values: ['—', '—', '—', '✓'] },
  { label: 'AI 產品行銷設計師', values: ['—', '策略＋文案', '全開', '全開'] },
  { label: 'AI 視覺工坊', values: ['—', '—', '基礎節點', '全節點'] },
  { label: 'GEO 內容寫手', values: ['每月 1 篇', '無限', '無限', '無限'] },
  { label: '行銷流水線', values: ['—', '—', '✓', '✓'] },
  { label: '潛在客戶行銷', values: ['蒐集＋篩選', '+Email', '+電話撥打', '全開'] },
  { label: '專家技能（點數扣款）', values: ['✓', '✓', '✓', '✓'] },
  { label: '自製專家', values: ['僅使用', '僅使用', '可建立', '可建立'] },
]

export function MarketingPlanUpgrade() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/plan')
      const data = await res.json()
      setPlan(data.plan ?? 'free')
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
    <div className="mb-5 rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">行銷方案</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
            目前：{plan === 'free' ? '免費' : plan === 'enterprise' ? '企業' : plan.toUpperCase()}
          </span>
          <a href="/settings" className="text-sm text-primary font-medium hover:underline">
            儲值點數 →
          </a>
        </div>
        <div className="flex gap-1 text-sm">
          <button onClick={() => setCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg font-medium ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            年繳（約 8 折）
          </button>
          <button onClick={() => setCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg font-medium ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            月繳
          </button>
        </div>
      </div>

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
                {isCurrent && <span className="text-xs flex items-center gap-1 text-primary font-medium"><Check className="h-3.5 w-3.5" />使用中</span>}
              </div>
              {cycle === 'monthly' ? (
                <div className="text-2xl font-bold">
                  ${c.monthlyUsd} <span className="text-sm font-normal text-muted-foreground">美元/月</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm line-through text-muted-foreground">${c.monthlyUsd}</span>
                    <span className="text-2xl font-bold">${yearlyMonthlyEquiv.toFixed(2)}</span>
                    <span className="text-sm font-normal text-muted-foreground">美元/月</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">省 {savingsPct}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">年繳 ${c.yearlyUsd} 美元</div>
                </div>
              )}
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {c.features.map(f => <li key={f}>· {f}</li>)}
              </ul>
              <button
                onClick={() => upgrade(packageId)}
                disabled={isCurrent || checkingOut === packageId}
                className="w-full mt-1 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {checkingOut === packageId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCurrent ? '目前方案' : '升級'}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">付款後方案立即生效，到期前不會自動續訂，需自行再次購買延續。圖片／影片／主播影片／電訪／Email 等生成成本以儲值點數另計，不含在訂閱費內。</p>

      <div>
        <h3 className="text-sm font-semibold mb-2">功能比較</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground">
                <th className="text-left font-medium py-2.5 px-3">功能</th>
                <th className="text-center font-medium py-2.5 px-3">免費</th>
                <th className="text-center font-medium py-2.5 px-3">PRO</th>
                <th className="text-center font-medium py-2.5 px-3">TEAM</th>
                <th className="text-center font-medium py-2.5 px-3">企業</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.label} className={`border-t ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                  <td className="text-left py-2.5 px-3 text-muted-foreground whitespace-nowrap">{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className="text-center py-2.5 px-3 font-medium">{v}</td>
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
