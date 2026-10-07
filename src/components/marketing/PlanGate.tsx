'use client'

// 行銷方案前端鎖定：包住整頁或區塊，方案不符時顯示鎖定卡與升級引導。
// 權威判斷在各 API（403），這裡只是體驗層，讓用戶不用踩到錯誤才知道要升級。
import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Lock, Loader2, Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'

// 呼叫端傳入的中文功能名／方案名 → 翻譯 key
const FEATURE_KEYS: Record<string, string> = {
  'AI 視覺工坊': 'aiStudio',
  'AI 產品行銷設計師': 'productDesigner',
  '行銷流水線': 'pipeline',
  '社群矩陣與自動養號': 'socialMatrix',
}
const PLAN_KEYS: Record<string, string> = { 'PRO 以上': 'proPlus', 'CORE 以上': 'corePlus' }

export interface MarketingPlanInfo {
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  features: Record<string, unknown> // Infinity 序列化為 null（視為無限）
}

let cached: MarketingPlanInfo | null = null

export function useMarketingPlan(): MarketingPlanInfo | null {
  const [info, setInfo] = useState<MarketingPlanInfo | null>(cached)
  useEffect(() => {
    if (cached) return
    fetch('/api/marketing/plan')
      .then(r => r.json())
      .then(d => { if (d?.plan) { cached = d; setInfo(d) } })
      .catch(() => setInfo({ plan: 'free', features: {} }))
  }, [])
  return info
}

export function PlanGate({
  allowed,
  featureName,
  requiredPlan,
  children,
}: {
  // 依方案判斷是否放行；null = 還在載入
  allowed: (info: MarketingPlanInfo) => boolean
  featureName: string
  requiredPlan: string
  children: ReactNode
}) {
  const info = useMarketingPlan()
  const t = useTranslations('PlanGate')
  const fk = FEATURE_KEYS[featureName]
  const pk = PLAN_KEYS[requiredPlan]

  if (!info) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (allowed(info)) return <>{children}</>

  return (
    <div className="flex items-center justify-center h-full min-h-[320px] p-6">
      <div className="max-w-sm w-full rounded-2xl border bg-card p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-bold mb-1">{fk ? t(`feature.${fk}`) : featureName}</h2>
          <p className="text-sm text-muted-foreground">
            {t('needPlan', { required: pk ? t(`plan.${pk}`) : requiredPlan, current: info.plan === 'free' ? t('free') : info.plan.toUpperCase() })}
          </p>
        </div>
        <Link
          href="/marketing/plan"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary"
        >
          <Crown className="h-4 w-4" />
          {t('upgrade')}
        </Link>
      </div>
    </div>
  )
}
