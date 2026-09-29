import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveJoinKey } from '@/lib/marketing/members'
import { getGa4MeasurementId } from '@/lib/marketing/ga4'
import Ga4Tag from '@/components/analytics/Ga4Tag'
import JoinForm from './JoinForm'

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const target = await resolveJoinKey(createAdminClient(), decodeURIComponent(key))
  return { title: target ? `加入會員｜${target.name || '會員專區'}` : '找不到此頁面' }
}

export default async function JoinPage({ params, searchParams }: {
  params: Promise<{ key: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { key } = await params
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const source = first(sp.utm_source) || first(sp.ref) || first(sp.src)
  const decoded = decodeURIComponent(key)
  const target = await resolveJoinKey(createAdminClient(), decoded)
  if (!target) return notFound()
  const gaId = await getGa4MeasurementId(target.ownerId)
  return (
    <>
      <Ga4Tag measurementId={gaId} />
      <JoinForm joinKey={decoded} name={target.name} source={source} />
    </>
  )
}
