import { createAdminClient } from '@/lib/supabase/admin'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BnbPublicNav from './nav'
import SiteMotion from './SiteMotion'
import Ga4Tag from '@/components/analytics/Ga4Tag'
import { getGa4MeasurementId } from '@/lib/marketing/ga4'
import { resolveDesign, siteThemeVars, isDarkBg } from '@/lib/booking/templates'

// 進場動畫：只在 SiteMotion 加上 motion-ready 後才先隱藏，實際動畫由 Motion 執行；沒有 JS 時內容照常顯示
const MOTION_CSS = `
.bnb-site.motion-ready [data-reveal]:not(.is-visible){opacity:0}
.bnb-site.motion-ready [data-split] [data-split-char]{opacity:0}
@media (prefers-reduced-motion: reduce){.bnb-site [data-reveal],.bnb-site [data-split-char]{opacity:1!important;transform:none!important}}
`

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: p, error } = await admin
    .from('bnb_profiles')
    .select('name, seo_title, seo_description, description, images')
    .eq('slug', slug)
    .single()
  // PGRST116 是「網址打錯／查無此民宿」的正常情況（公開網址會被爬蟲亂打），不記錄；
  // 其餘是真的查詢失敗，會讓存在的民宿顯示成找不到。
  if (error && error.code !== 'PGRST116') console.error('[bnb-public] bnb_profiles 查詢失敗', { slug, error })
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
  const { data: profile, error } = await admin
    .from('bnb_profiles')
    .select('user_id, name, theme_color, template_id, custom_design, slug')
    .eq('slug', slug)
    .single()
  // 查詢失敗會讓實際存在的民宿對客人顯示成 404，跟「網址打錯」看起來一模一樣。
  if (error && error.code !== 'PGRST116') console.error('[bnb-public] bnb_profiles 查詢失敗', { slug, error })

  if (!profile) notFound()
  const design = resolveDesign(profile)
  const gaId = await getGa4MeasurementId(profile.user_id as string)

  return (
    <div className="bnb-site min-h-screen bg-[var(--bnb-page)] text-[var(--bnb-ink)] flex flex-col"
      data-anim={design.animation} style={{ ...siteThemeVars(design), colorScheme: isDarkBg(design.pageBg) ? 'dark' : 'light' } as React.CSSProperties}>
      {(design.animation !== 'none' || design.textReveal) && <style>{MOTION_CSS}</style>}
      <SiteMotion animation={design.animation} parallax={design.parallax} textReveal={design.textReveal} />
      {/* 只載入這個模板/自訂設計需要的中文標題字型，不讓每種字型都塞進每個網站 */}
      <link rel="stylesheet" href={design.headingFontHref} />
      <Ga4Tag measurementId={gaId} />
      <BnbPublicNav profile={{ name: profile.name, theme_color: profile.theme_color, template_id: profile.template_id, custom_design: profile.custom_design, slug: profile.slug }} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-gray-300">
        Powered by IMT
      </footer>
    </div>
  )
}
