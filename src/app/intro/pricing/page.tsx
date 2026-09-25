import type { Metadata } from 'next'
import { introSystem } from '../_host'
import { MarketingPricing, marketingPricingMetadata } from './MarketingPricing'
import { CsPricing, csPricingMetadata } from '../_cs/CsPricing'
import { BookingPricing, bookingPricingMetadata } from '../_booking/BookingPricing'

export const dynamic = 'force-dynamic'

// cs／booking 子網域 → 各自的方案頁；其餘（marketing）→ 行銷中心版本（其他子網域由 middleware 導走）
export async function generateMetadata(): Promise<Metadata> {
  const sys = await introSystem()
  return sys === 'cs' ? csPricingMetadata : sys === 'booking' ? bookingPricingMetadata : marketingPricingMetadata
}

export default async function IntroPricingPage() {
  const sys = await introSystem()
  return sys === 'cs' ? <CsPricing /> : sys === 'booking' ? <BookingPricing /> : <MarketingPricing />
}
