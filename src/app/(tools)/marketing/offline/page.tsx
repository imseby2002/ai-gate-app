import { redirect } from 'next/navigation'

// 「實體行銷」已併入活動企劃中心（通路選「實體」即可）
export default function MarketingOfflinePage() {
  redirect('/marketing/campaigns')
}
