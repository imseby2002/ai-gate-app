import { createAdminClient } from '@/lib/supabase/admin'
import { Metadata } from 'next'
import PublicSitePage from './PublicSitePage'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: p } = await admin
    .from('bnb_profiles')
    .select('name, seo_title, seo_description, description, images')
    .eq('slug', slug)
    .single()
  if (!p) return { title: '找不到此民宿' }
  const title = p.seo_title || p.name
  const description = p.seo_description || p.description || ''
  const image = (p.images as string[] | null)?.[0]
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        找不到此民宿
      </div>
    )
  }

  const { data: properties } = await admin
    .from('properties')
    .select('*')
    .eq('user_id', profile.user_id)
    .eq('status', 'active')

  return <PublicSitePage profile={profile} properties={properties ?? []} slug={slug} />
}
