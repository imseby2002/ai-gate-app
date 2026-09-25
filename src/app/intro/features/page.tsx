import type { Metadata } from 'next'
import { introSystem } from '../_host'
import { MarketingFeatures, marketingFeaturesMetadata } from './MarketingFeatures'
import { CsFeatures, csFeaturesMetadata } from '../_cs/CsFeatures'

export const dynamic = 'force-dynamic'

// cs 子網域 → 客服功能頁；其餘（marketing）→ 行銷中心功能頁（非 marketing/cs 子網域由 middleware 導走）
export async function generateMetadata(): Promise<Metadata> {
  return (await introSystem()) === 'cs' ? csFeaturesMetadata : marketingFeaturesMetadata
}

export default async function IntroFeaturesPage() {
  return (await introSystem()) === 'cs' ? <CsFeatures /> : <MarketingFeatures />
}
