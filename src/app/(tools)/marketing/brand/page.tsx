'use client'

// 行銷中心「公司資料」：與 ERP /mkt「公司資料」分頁為同一元件、同一份資料
import { Fingerprint } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CompanyProfileEditor } from '@/components/company/CompanyProfileEditor'

export default function MarketingBrandPage() {
  const t = useTranslations('Marketing')
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Fingerprint className="h-5 w-5 text-indigo-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('brandPage.title')}</h1>
          <p className="text-sm text-gray-500">{t('brandPage.desc')}</p>
        </div>
      </div>
      <CompanyProfileEditor />
    </div>
  )
}
