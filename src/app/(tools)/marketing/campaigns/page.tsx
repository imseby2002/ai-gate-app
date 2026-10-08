'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CampaignsTab } from '@/components/marketing/CampaignsTab'

// 行銷中心「活動企劃中心」：實體／線上／混合活動統一在此新增與追蹤（原「實體行銷」已併入）
export default function MarketingCampaignsPage() {
  const t = useTranslations('MktCampaignsPage')
  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Sparkles className="h-5 w-5 text-purple-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </div>
      <CampaignsTab />
    </div>
  )
}
