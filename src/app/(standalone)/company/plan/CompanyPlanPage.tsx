'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Lock, Building2 } from 'lucide-react'
import { YEARLY_MONTHS, type CompanyPriceLine } from '@/lib/company/pricing'

type Cycle = 'monthly' | 'yearly'

interface PlanData {
  plan: string
  companyName: string
  currentPeriodEnd: string | null
  price: { lines: CompanyPriceLine[]; monthlyUsd: number }
}

// 公司方案為模組化計價：開通內容（模組、ERP 人數、門市數、自訂網域）由平台設定，
// 公司在這裡確認明細並付款。價格計算見 lib/company/pricing.ts。
export function CompanyPlanPage({ isOwnerOrAdmin }: { isOwnerOrAdmin: boolean }) {
  const [data, setData] = useState<PlanData | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/company/plan')
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? '載入失敗'); return }
      setData(d)
    } catch { setError('網路錯誤，請稍後再試') }
  }, [])

  useEffect(() => { load() }, [load])

  const pay = async () => {
    setCheckingOut(true)
    setError('')
    try {
      const res = await fetch('/api/billing/create-company-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle, returnUrl: window.location.href }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? '建立訂單失敗'); return }

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
      setError('網路錯誤，請稍後再試')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground text-sm">{error || '載入中…'}</div>
  }

  const active = data.plan === 'company'
  const monthly = data.price.monthlyUsd
  const total = cycle === 'yearly' ? monthly * YEARLY_MONTHS : monthly
  const endDate = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString('zh-TW') : null

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-16 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
            <Building2 className="h-5 w-5 shrink-0" />
            {data.companyName || '公司'} · 公司方案
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            成員不限人數；開通的客服、訂房、行銷模組皆為 MAX 等級。含 CHAT 免費對話與每月 1 次免費功能微調。
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            {active
              ? <span className="flex items-center gap-1 text-green-600 font-medium"><Check className="h-4 w-4" />公司方案使用中{endDate ? `，到期日 ${endDate}` : ''}</span>
              : <span className="text-muted-foreground">尚未啟用公司方案</span>}
          </div>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setCycle('yearly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              年繳（10 個月價格）
            </button>
            <button onClick={() => setCycle('monthly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
              月繳
            </button>
          </div>
        </div>

        {!isOwnerOrAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>付款需由<strong>公司負責人或管理員</strong>操作。</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
          <div className="font-semibold text-foreground">計價明細（美元／月）</div>
          {data.price.lines.map(l => (
            <div key={l.label} className="flex justify-between text-muted-foreground tabular-nums">
              <span>{l.label}</span><span>${l.usd}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-bold text-foreground tabular-nums">
            <span>{cycle === 'yearly' ? `年繳合計（每月 $${monthly} × ${YEARLY_MONTHS}）` : '每月合計'}</span>
            <span>${total}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">開通模組、ERP 人數與門市數由平台依合約設定，如需調整請聯繫我們。</p>
        </div>

        <button
          onClick={pay}
          disabled={!isOwnerOrAdmin || checkingOut}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
          {active ? '續約' : '付款啟用'}（${total} 美元）
        </button>

        <p className="text-[11px] text-muted-foreground">付款後立即生效；續約會從原到期日往後延長。到期前不會自動續訂。</p>
      </div>
    </div>
  )
}
