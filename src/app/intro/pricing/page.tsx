import type { Metadata } from 'next'
import { introSystem } from '../_host'
import { MarketingPricing, marketingPricingMetadata } from './MarketingPricing'
import { CsPricing, csPricingMetadata } from '../_cs/CsPricing'

export const dynamic = 'force-dynamic'

// cs 子網域 → 客服方案頁；其餘（marketing）→ 行銷中心方案頁（非 marketing/cs 子網域由 middleware 導走）
export async function generateMetadata(): Promise<Metadata> {
  return (await introSystem()) === 'cs' ? csPricingMetadata : marketingPricingMetadata
}

export default async function IntroPricingPage() {
  return (await introSystem()) === 'cs' ? <CsPricing /> : <MarketingPricing />
}
