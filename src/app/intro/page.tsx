import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'
import { MarketingIntro, marketingMetadata } from './MarketingIntro'
import { CsIntro, csMetadata } from './CsIntro'

export const dynamic = 'force-dynamic'

// 各子網域的 /intro 顯示該系統自己的廣告頁（cs.im-tourist.com/intro → 客服）。
// 系統子網域還沒有廣告頁的 → 回該子網域首頁；非系統子網域（www、主網域、localhost）沿用行銷中心頁。
const INTROS = {
  cs: { Page: CsIntro, metadata: csMetadata },
  marketing: { Page: MarketingIntro, metadata: marketingMetadata },
} as const

async function resolveIntro() {
  const host = (await headers()).get('host') ?? ''
  const sys = SUBDOMAIN_SYSTEM[host.split('.')[0]]
  if (!sys) return INTROS.marketing
  return sys in INTROS ? INTROS[sys as keyof typeof INTROS] : null
}

export async function generateMetadata(): Promise<Metadata> {
  return (await resolveIntro())?.metadata ?? {}
}

export default async function IntroPage() {
  const intro = await resolveIntro()
  if (!intro) redirect('/')
  return <intro.Page />
}
