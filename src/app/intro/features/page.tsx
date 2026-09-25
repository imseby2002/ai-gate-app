import type { Metadata } from 'next'
import { introSystem } from '../_host'
import { MarketingFeatures, marketingFeaturesMetadata } from './MarketingFeatures'
import { CsFeatures, csFeaturesMetadata } from '../_cs/CsFeatures'
import { BookingFeatures, bookingFeaturesMetadata } from '../_booking/BookingFeatures'

export const dynamic = 'force-dynamic'

// cs／booking 子網域 → 各自的功能頁；其餘（marketing）→ 行銷中心版本（其他子網域由 middleware 導走）
export async function generateMetadata(): Promise<Metadata> {
  const sys = await introSystem()
  return sys === 'cs' ? csFeaturesMetadata : sys === 'booking' ? bookingFeaturesMetadata : marketingFeaturesMetadata
}

export default async function IntroFeaturesPage() {
  const sys = await introSystem()
  return sys === 'cs' ? <CsFeatures /> : sys === 'booking' ? <BookingFeatures /> : <MarketingFeatures />
}
