import { createAdminClient } from '@/lib/supabase/admin'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BnbPublicNav from './nav'
import { resolveDesign } from '@/lib/booking/templates'

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

export default async function BnbPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('name, theme_color, template_id, custom_design, slug')
    .eq('slug', slug)
    .single()

  if (!profile) notFound()
  const design = resolveDesign(profile)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 只載入這個模板/自訂設計需要的中文標題字型，不讓每種字型都塞進每個網站 */}
      <link rel="stylesheet" href={design.headingFontHref} />
      <BnbPublicNav profile={{ name: profile.name, theme_color: profile.theme_color, template_id: profile.template_id, custom_design: profile.custom_design, slug: profile.slug }} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-gray-300">
        Powered by AI GATE
      </footer>
    </div>
  )
}
