import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PublicHomePage from './PublicSitePage'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()

  const { data: properties } = await admin
    .from('properties')
    .select('*')
    .eq('user_id', profile.user_id)
    .eq('status', 'active')
    .limit(6)

  return <PublicHomePage profile={profile} properties={properties ?? []} slug={slug} />
}
