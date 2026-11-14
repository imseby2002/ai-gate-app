'use client'

import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { systemForPath, getLocalizedSystemDef } from '@/lib/systems'

// 各工具模組共用的極簡頂部列品牌區塊——依目前路徑顯示該模組自己的名稱
// （例如訂房系統顯示「IMT 智能訂房系統」），不是統一都寫死「IMT」。
export function ToolsBrand() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Nav')
  const sys = systemForPath(pathname)
  const label = sys ? getLocalizedSystemDef(sys, locale).label : 'IMT'

  return (
    <div className="flex items-center gap-2">
      <BrandLogo className="h-7 w-7" />
      <div className="leading-none">
        <span className="block text-xs font-bold text-gray-800">{label}</span>
        <span className="block text-[10px] mt-0.5 font-medium whitespace-nowrap">
          <span className="text-[#111827]">{t('csSloganLine1')}</span>
          <span className="text-gray-400">{locale.startsWith('zh') ? '｜' : ' | '}</span>
          <span className="text-[#139488]">{t('csSloganLine2')}</span>
        </span>
      </div>
    </div>
  )
}
