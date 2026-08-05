import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { getTemplate } from '@/lib/booking/templates'
import { ChevronDown, ChevronUp } from 'lucide-react'
import AboutFaq from './AboutFaq'

const AMENITY_EMOJI: Record<string, string> = {
  'WiFi': '📶', 'Wi-Fi': '📶', '停車場': '🅿️', '冷氣': '❄️', '浴缸': '🛁',
  '廚房': '🍳', '早餐': '☕', '游泳池': '🏊', '健身房': '💪', '烤肉': '🔥',
  '腳踏車': '🚲', '寵物': '🐾', '洗衣機': '👕', '電視': '📺',
  '山景': '⛰️', '海景': '🌊', '湖景': '🏞️',
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('*')
    .eq('slug', slug)
    .single()
  if (!profile) notFound()

  const tpl       = getTemplate(profile.template_id)
  const accent    = profile.theme_color || tpl.defaultAccent
  const aStyle    = { backgroundColor: accent }
  const aText     = { color: accent }
  const headingStyle = { color: tpl.ink, fontFamily: tpl.headingFontFamily, fontWeight: tpl.headingWeight }
  const bodyStyle = { color: tpl.ink }
  const images    = (profile.images as string[] | null) ?? []
  const amenities = (profile.amenities as string[] | null) ?? []
  const faq       = (profile.faq as { q: string; a: string }[] | null) ?? []

  return (
    <div>
      {/* ── Hero banner ── */}
      {images[0] && (
        <div className="w-full aspect-[21/6] overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt={profile.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-end">
            <div className="max-w-5xl mx-auto px-4 pb-6 w-full">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">關於我們</h1>
              <p className="text-white/70 text-sm mt-1">{profile.name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {!images[0] && (
          <h1 className={`text-3xl ${tpl.headingClass} ${profile.template_id === 'boutique' ? 'text-2xl' : ''}`} style={headingStyle}>
            關於我們
          </h1>
        )}

        {/* ── 故事 ── */}
        {(profile.about || profile.description) && (
          <section className="space-y-4">
            <h2 className={`text-xl border-b pb-2 ${tpl.headingClass}`} style={{ ...headingStyle, borderColor: accent }}>
              民宿故事
            </h2>
            <p className="leading-relaxed whitespace-pre-wrap text-[15px]" style={bodyStyle}>
              {profile.about || profile.description}
            </p>
          </section>
        )}

        {/* ── 主人介紹 ── */}
        {profile.owner_intro && (
          <section className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: tpl.sectionBg }}>
            <h2 className={tpl.headingClass} style={headingStyle}>主人介紹</h2>
            <p className="leading-relaxed whitespace-pre-wrap text-[15px]" style={bodyStyle}>{profile.owner_intro}</p>
          </section>
        )}

        {/* ── 相片 ── */}
        {images.length > 1 && (
          <section className="space-y-4">
            <h2 className={`text-xl border-b pb-2 ${tpl.headingClass}`} style={{ ...headingStyle, borderColor: accent }}>
              民宿相片
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {images.map((src, i) => (
                <div key={i} className={`aspect-square overflow-hidden ${profile.template_id === 'boutique' ? '' : 'rounded-xl'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 設施 ── */}
        {amenities.length > 0 && (
          <section className="space-y-4">
            <h2 className={`text-xl border-b pb-2 ${tpl.headingClass}`} style={{ ...headingStyle, borderColor: accent }}>
              設施與服務
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {amenities.map(a => (
                <div key={a}
                  className={`flex items-center gap-2.5 px-4 py-3 text-sm ${tpl.cardClass}`}
                  style={{ backgroundColor: tpl.cardBg, borderColor: tpl.cardBorder, color: tpl.ink }}>
                  <span className="text-lg">{AMENITY_EMOJI[a] ?? '✓'}</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 住宿規則 ── */}
        {profile.house_rules && (
          <section className="space-y-4">
            <h2 className={`text-xl border-b pb-2 ${tpl.headingClass}`} style={{ ...headingStyle, borderColor: accent }}>
              住宿規則
            </h2>
            <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ backgroundColor: tpl.sectionBg, color: tpl.ink }}>
              {profile.house_rules}
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        {faq.length > 0 && (
          <section className="space-y-4">
            <h2 className={`text-xl border-b pb-2 ${tpl.headingClass}`} style={{ ...headingStyle, borderColor: accent }}>
              常見問題
            </h2>
            <AboutFaq items={faq} accent={accent} />
          </section>
        )}
      </div>
    </div>
  )
}
