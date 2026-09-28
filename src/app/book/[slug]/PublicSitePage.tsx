'use client'
import Link from 'next/link'
import { MapPin, Clock, Coffee, Users, ChevronRight, BedDouble, Phone, Mail, MessageCircle } from 'lucide-react'
import { resolveDesign, headingCss } from '@/lib/booking/templates'
import SplitText from './SplitText'

interface BnbProfile {
  name: string; tagline?: string | null; description?: string | null; about?: string | null
  address?: string | null; city?: string | null; phone?: string | null; email?: string | null
  line_id?: string | null; check_in_time?: string | null; check_out_time?: string | null
  min_nights?: number | null; breakfast?: { type: string } | null
  images?: string[] | null; theme_color?: string | null; template_id?: string | null
  custom_design?: unknown
  hero_cta_text?: string | null
}
interface Property {
  id: string; name: string; description?: string | null
  base_price?: number | null; max_guests?: number | null; images?: string[] | null
}

const AMENITY_EMOJI: Record<string, string> = {
  'WiFi': '📶', 'Wi-Fi': '📶', '停車場': '🅿️', '冷氣': '❄️', '浴缸': '🛁',
  '廚房': '🍳', '早餐': '☕', '游泳池': '🏊', '健身房': '💪', '烤肉': '🔥',
  '腳踏車': '🚲', '寵物': '🐾', '洗衣機': '👕', '電視': '📺',
  '山景': '⛰️', '海景': '🌊', '湖景': '🏞️',
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default function PublicHomePage({
  profile, properties, slug,
}: {
  profile: BnbProfile; properties: Property[]; slug: string
}) {
  const design = resolveDesign(profile)
  const accent = design.accent
  const aStyle = { backgroundColor: accent }
  const aText  = { color: accent }
  const aBorder = { borderColor: accent }
  const headingStyle = headingCss(design)
  const mutedStyle   = { color: design.muted }
  const btnStyle     = { borderRadius: design.btnRadius }
  const base   = `/book/${slug}`
  const images = (profile.images as string[] | null) ?? []
  const heroImg = images[0]
  const ctaText = profile.hero_cta_text || '立即訂房'
  // 有照片時文字壓在暗化遮罩上一律白字；沒照片時 Hero 底色是主色，文字要跟主色按鈕用同一個對比色
  const heroFg = heroImg ? '#ffffff' : design.onAccent

  const heroContent = (
    <div className={`relative z-10 max-w-5xl mx-auto px-4 w-full
      ${heroImg ? 'py-16 sm:py-24' : 'py-10 sm:py-14'}
      ${design.heroLayout === 'centered' ? 'flex flex-col items-center text-center' : 'flex flex-col items-start text-left'}`}>
      {profile.name && (
        <h1 className={`leading-tight ${design.headingUppercase ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}
          style={headingCss(design, heroFg)}>
          <SplitText text={profile.name} enabled={design.textReveal} />
        </h1>
      )}
      {profile.tagline && (
        // 不限窄欄寬，避免一句標語在大螢幕被硬折成兩行；手機寬度不夠時才自然換行
        <p className={`${profile.name ? 'mt-3' : ''} text-lg sm:text-xl opacity-80`} style={{ color: heroFg }}>{profile.tagline}</p>
      )}
      {profile.address && (
        <p className="mt-2 text-sm opacity-60 flex items-center gap-1" style={{ color: heroFg }}>
          <MapPin className="h-3.5 w-3.5" />
          {profile.city ? `${profile.city} · ` : ''}{profile.address}
        </p>
      )}
      <div className="flex flex-wrap gap-3 mt-6">
        <Link href={`${base}/booking`}
          className="px-6 py-3 text-sm font-bold hover:opacity-90 transition-opacity"
          // 沒照片時 Hero 本身就是主色底，主色按鈕會跟背景融在一起，改成反色
          style={heroImg
            ? { ...aStyle, ...btnStyle, color: design.onAccent }
            : { ...btnStyle, backgroundColor: design.onAccent, color: accent }}>
          {ctaText}
        </Link>
        {properties.length > 0 && (
          <Link href={`${base}/rooms`}
            className="px-6 py-3 text-sm font-semibold border-2 hover:bg-white/10 transition-colors"
            style={{ ...btnStyle, color: heroFg, borderColor: heroFg }}>
            查看房型
          </Link>
        )}
      </div>
    </div>
  )

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative w-full overflow-hidden"
        style={heroImg ? { minHeight: design.heroLayout === 'minimal' ? '50vh' : '70vh' } : undefined}>
        {heroImg ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImg} alt={profile.name} data-parallax={design.parallax ? '' : undefined}
              className="absolute inset-0 w-full h-full object-cover" />
            <div className={`absolute inset-0
              ${design.heroLayout === 'overlay-left'
                ? 'bg-gradient-to-r from-black/70 via-black/40 to-transparent'
                : design.heroLayout === 'minimal'
                  ? 'bg-black/20'
                  : 'bg-black/50'}`} />
          </>
        ) : (
          <div className="absolute inset-0" style={aStyle} />
        )}

        {design.heroLayout === 'minimal' ? (
          <div className="relative z-10 flex flex-col h-full" style={{ minHeight: '50vh' }}>
            <div className="flex-1" />
            <div className="bg-[color-mix(in_srgb,var(--bnb-page)_90%,transparent)] backdrop-blur max-w-5xl mx-auto w-full px-4 py-6 sm:py-8">
              <h1 className="text-3xl sm:text-4xl" style={headingStyle}><SplitText text={profile.name} enabled={design.textReveal} /></h1>
              {profile.tagline && <p className="mt-1" style={mutedStyle}>{profile.tagline}</p>}
              <div className="flex flex-wrap gap-3 mt-4">
                <Link href={`${base}/booking`}
                  className="px-6 py-2.5 text-sm font-bold text-[var(--bnb-on-accent)] hover:opacity-90"
                  style={{ ...aStyle, ...btnStyle }}>
                  {ctaText}
                </Link>
                {properties.length > 0 && (
                  <Link href={`${base}/rooms`}
                    className="px-6 py-2.5 text-sm font-semibold border-2 hover:bg-gray-50"
                    style={{ ...aBorder, ...btnStyle }}>
                    查看房型
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : heroContent}
      </section>

      {/* ── Quick badges ── */}
      <section className="bg-[var(--bnb-page)] border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2">
          {profile.check_in_time && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              <Clock className="h-3 w-3" />入住 {profile.check_in_time} 後
            </span>
          )}
          {profile.check_out_time && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              <Clock className="h-3 w-3" />退房 {profile.check_out_time} 前
            </span>
          )}
          {profile.breakfast?.type === 'included' && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: `${accent}18`, color: accent }}>
              <Coffee className="h-3 w-3" />含早餐
            </span>
          )}
          {profile.min_nights && profile.min_nights > 1 && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              最少 {profile.min_nights} 晚
            </span>
          )}
        </div>
      </section>

      {/* ── 精選房型 ── */}
      {properties.length > 0 && (
        <section style={{ backgroundColor: design.sectionBg, paddingTop: design.sectionPaddingY, paddingBottom: design.sectionPaddingY }}>
          <div className="max-w-5xl mx-auto px-4">
            <div data-reveal className="flex items-end justify-between mb-6">
              <h2 className={design.headingUppercase ? 'text-xl' : 'text-2xl'} style={headingStyle}>
                <SplitText text="精選房型" enabled={design.textReveal} />
              </h2>
              <Link href={`${base}/rooms`} className="text-sm hover:underline flex items-center gap-1" style={aText}>
                查看全部 <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.slice(0, 3).map(prop => {
                const img = (prop.images as string[] | null)?.[0]
                return (
                  <div key={prop.id} data-reveal data-card className="overflow-hidden border"
                    style={{ backgroundColor: design.cardBg, borderColor: design.cardBorder, borderRadius: design.cardRadius, boxShadow: design.shadow || undefined }}>
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={prop.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BedDouble className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold" style={{ color: design.ink, fontFamily: design.headingFontFamily }}>{prop.name}</h3>
                        {prop.base_price && (
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm" style={aText}>NT$ {fmt(prop.base_price)}</div>
                            <div className="text-[10px]" style={mutedStyle}>/ 晚</div>
                          </div>
                        )}
                      </div>
                      {prop.description && (
                        <p className="text-xs line-clamp-2" style={mutedStyle}>{prop.description}</p>
                      )}
                      <div className="text-xs flex items-center gap-1" style={mutedStyle}>
                        <Users className="h-3.5 w-3.5" />最多 {prop.max_guests ?? 2} 人
                      </div>
                      <Link href={`${base}/booking?room=${prop.id}`}
                        className="block w-full text-center py-2 text-[var(--bnb-on-accent)] text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ ...aStyle, ...btnStyle }}>
                        選擇此房型
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 關於 teaser ── */}
      {(profile.about || profile.description) && (
        <section style={{ paddingTop: design.sectionPaddingY, paddingBottom: design.sectionPaddingY }}>
          <div className="max-w-5xl mx-auto px-4">
            <div data-reveal className="grid sm:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h2 className={design.headingUppercase ? 'text-xl' : 'text-2xl'} style={headingStyle}>
                  <SplitText text="關於我們" enabled={design.textReveal} />
                </h2>
                <p className="leading-relaxed line-clamp-5" style={mutedStyle}>
                  {profile.about || profile.description}
                </p>
                <Link href={`${base}/about`} className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" style={aText}>
                  了解更多 <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {images.length === 1 && (
                // 只有一張照片時也放在右側，避免「關於我們」右半邊整片空白
                <div className={`aspect-[4/3] overflow-hidden ${profile.template_id === 'boutique' ? '' : 'rounded-xl'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[0]} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              {images.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  {images.slice(1, 5).map((src, i) => (
                    <div key={i} className={`aspect-square overflow-hidden ${profile.template_id === 'boutique' ? '' : 'rounded-xl'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 聯絡 strip ── */}
      <section className="py-8 border-t" style={{ backgroundColor: design.sectionBg }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <h3 className="font-semibold" style={{ color: design.ink, fontFamily: design.headingFontFamily }}>聯絡我們</h3>
            <div className="flex flex-wrap gap-3">
              {profile.phone && (
                <a href={`tel:${profile.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-[var(--bnb-page)] border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  <Phone className="h-4 w-4" style={aText} />{profile.phone}
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-[var(--bnb-page)] border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  <Mail className="h-4 w-4" style={aText} />{profile.email}
                </a>
              )}
              {profile.line_id && (
                <a href={`https://line.me/ti/p/~${profile.line_id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-[var(--bnb-page)] border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  <MessageCircle className="h-4 w-4" style={aText} />LINE
                </a>
              )}
              <Link href={`${base}/contact`} className="text-sm font-medium hover:underline" style={aText}>
                查看完整聯絡資訊 →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
