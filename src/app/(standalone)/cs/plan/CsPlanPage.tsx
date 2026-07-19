'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Sparkles, Loader2, Lock, RefreshCw } from 'lucide-react'
import { CS_FEATURE_REQUEST_PRICING, type CsPlanFeatures } from '@/lib/cs/entitlements'
import { CsSideNav } from '../CsSideNav'

// 等級名稱在所有語言都固定用 FREE / CORE / PRO / MAX
type CsPlan = 'free' | 'core' | 'pro' | 'max'
type Cycle = 'monthly' | 'yearly'

const PLAN_NAME: Record<CsPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', max: 'MAX' }

const PLAN_META = [
  { id: 'free' as CsPlan, monthlyUsd: 0, yearlyUsd: 0, highlight: false, monthlyId: undefined as string | undefined, yearlyId: undefined as string | undefined,
    features: ['3 個平台串接', '不限訊息則數', '基本 AI 設定'] },
  { id: 'core' as CsPlan, monthlyUsd: 19, yearlyUsd: 182, highlight: true, monthlyId: 'core_monthly', yearlyId: 'core_yearly',
    features: ['Claude 風險升級', 'WhatsApp 個人版', 'AI 設定全開', '資料來源／工單／收件匣'] },
  { id: 'pro' as CsPlan, monthlyUsd: 29, yearlyUsd: 278, highlight: false, monthlyId: 'pro_monthly', yearlyId: 'pro_yearly',
    features: ['包含 CORE 全部功能', '無限協作人員', '每月 1 次免費協助設定'] },
  { id: 'max' as CsPlan, monthlyUsd: 41, yearlyUsd: 399, highlight: false, monthlyId: 'max_monthly', yearlyId: 'max_yearly',
    features: ['包含 PRO 全部功能', '不限平台數', '報價計算機', '每月 2 次免費協助設定'] },
]

// 功能比較表：四欄方案值（免費／PRO／TEAM／企業）＋ market（市場常見模式，用來對比痛點）
const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string]; market: string }> = [
  { label: '客服訊息則數', values: ['不限', '不限', '不限', '不限'], market: '每月 50–100 則上限，超過加價' },
  { label: '平台串接數', values: ['3 個', '3 個', '3 個', '不限'], market: '依方案 1–2 個' },
  { label: 'WhatsApp 個人版', values: ['—', '✓', '✓', '✓'], market: '多數不支援' },
  { label: '知識庫', values: ['✓', '✓', '✓', '✓'], market: '常需加購' },
  { label: '協作人員', values: ['不可邀請', '1 位', '無限', '無限'], market: '按席位另計' },
  { label: 'AI 設定', values: ['基本', '完整', '完整', '完整'], market: '基礎版本' },
  { label: 'Claude 風險升級', values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: '資料來源管理', values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: '工單系統', values: ['—', '✓', '✓', '✓'], market: '常需加購' },
  { label: '統一收件匣', values: ['—', '✓', '✓', '✓'], market: '常需加購' },
  { label: '自動學習', values: ['—', '✓', '✓', '✓'], market: '—' },
  { label: '報價計算機', values: ['—', '—', '—', '✓'], market: '—' },
  { label: '協助設定（免費額度／月）', values: ['0（$25/次）', '0（$15/次）', '1 次', '2 次'], market: '通常另計顧問費' },
]

export function CsPlanPage({ isOwner }: { isOwner: boolean }) {
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
    if (!confirm('確定要取消自動續訂嗎？取消後不會再自動扣款。')) return
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
      alert(err instanceof Error ? err.message : '取消失敗，請稍後再試')
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
      if (autoRenewPkg[packageId]) setTimeout(loadRecurringOrders, 3000)
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setCheckingOut(null)
    }
  }

  if (plan == null) return <div className="p-6 text-muted-foreground text-sm">載入中…</div>

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-16 flex flex-col sm:flex-row gap-5 items-start">
        <CsSideNav active="plan" features={features} />
        <div className="flex-1 min-w-0 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
            <Sparkles className="h-5 w-5 shrink-0" />
            不限則數，不怕用量爆表加價
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            對話量再大，方案價格都固定——不像市場常見的「按則數計費」，用越多帳單越嚇人。
          </p>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">訂閱方案</h1>
            <p className="text-sm text-muted-foreground mt-0.5">依平台串接數與功能選擇適合的方案，隨時可升級</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              目前：{PLAN_NAME[plan]}
            </span>
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
        </div>

        {!isOwner && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>方案升級需由<strong>民宿擁有者本人</strong>操作。如需升級請改用擁有者帳號登入。</span>
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
                      每{cycle === 'yearly' ? '年' : '月'}自動於下一期扣款
                    </label>
                    <button
                      onClick={() => upgrade(packageId!)}
                      disabled={!isOwner || isCurrent || checkingOut === packageId}
                      className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {checkingOut === packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {isCurrent ? '目前方案' : '升級'}
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
              <RefreshCw className="h-3.5 w-3.5" /> 自動續訂中
            </div>
            {recurringOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <div className="font-medium text-foreground">
                    {o.reference_id}<span className="ml-2 text-muted-foreground">${o.usd_value}/月</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {o.status === 'pending' ? '等待首筆扣款確認中' : `已成功扣款 ${o.total_success_times} 次`}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelRecurring(o.id)}
                  disabled={cancellingId === o.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-accent disabled:opacity-50"
                >
                  {cancellingId === o.id ? '取消中…' : '取消自動續訂'}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">付款後方案立即生效；未勾選自動扣款時，到期前不會自動續訂，需自行再次購買延續。</p>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left font-medium py-2.5 px-3 text-muted-foreground">功能</th>
                {(['free', 'core', 'pro', 'max'] as CsPlan[]).map(id => (
                  <th key={id} className="text-center font-medium py-2.5 px-3 text-muted-foreground">{PLAN_NAME[id]}</th>
                ))}
                <th className="text-center font-semibold py-2.5 px-3 text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 whitespace-nowrap">市場常見模式</th>
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
                  <td className="text-center py-2.5 px-3 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25">
                    {row.market}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground space-y-2">
          <p>
            「協助設定」與「客製功能」不同：協助設定僅協助頻道串接與參數設定，依方案有免費額度；
            客製功能是提供方案本身沒有的功能或需要改寫程式——
            基礎客製固定 ${CS_FEATURE_REQUEST_PRICING.basicPriceUsd}/次（{CS_FEATURE_REQUEST_PRICING.basicNote}），
            進階或複雜功能{CS_FEATURE_REQUEST_PRICING.advancedNote}。
          </p>
          <p>
            協助設定範圍：站內所有設定（資料來源、報價計算機等）與各平台串接設定皆包含在內；
            但不包含知識庫內容建立，以及各平台（LINE、WhatsApp 等）官方帳號本身的申請，這兩項需要另外報價。
          </p>
          <p className="text-primary font-medium">🎁 新會員首次協助設定免費（不分方案，每個帳號一次）。</p>
        </div>
        </div>
      </div>
    </div>
  )
}
