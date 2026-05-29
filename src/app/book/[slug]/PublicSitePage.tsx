'use client'
import Link from 'next/link'
import { MapPin, Clock, Coffee, Users, ChevronRight, BedDouble, Phone, Mail, MessageCircle } from 'lucide-react'
import { getTemplate } from '@/lib/booking/templates'

interface BnbProfile {
  name: string; tagline?: string | null; description?: string | null; about?: string | null
  address?: string | null; city?: string | null; phone?: string | null; email?: string | null
  line_id?: string | null; check_in_time?: string | null; check_out_time?: string | null
  min_nights?: number | null; breakfast?: { type: string } | null
  images?: string[] | null; theme_color?: string | null; template_id?: string | null
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
  const tpl    = getTemplate(profile.template_id)
  const accent = profile.theme_color || tpl.defaultAccent
  const aStyle = { backgroundColor: accent }
  const aText  = { color: accent }
  const aBorder = { borderColor: accent }
  const base   = `/book/${slug}`
  const images = (profile.images as string[] | null) ?? []
  const heroImg = images[0]
  const ctaText = profile.hero_cta_text || '立即訂房'

  const heroContent = (
    <div className={`relative z-10 max-w-5xl mx-auto px-4 py-16 sm:py-24 w-full
      ${tpl.heroLayout === 'centered' ? 'flex flex-col items-center text-center' : 'flex flex-col items-start text-left'}`}>
      <h1 className={`text-4xl sm:text-5xl font-bold text-white leading-tight
        ${tpl.heroLayout === 'boutique' ? 'tracking-widest uppercase text-3xl sm:text-4xl' : ''}`}>
        {profile.name}
      </h1>
      {profile.tagline && (
        <p className="mt-3 text-lg sm:text-xl text-white/80 max-w-xl">{profile.tagline}</p>
      )}
      {profile.address && (
        <p className="mt-2 text-sm text-white/60 flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {profile.city ? `${profile.city} · ` : ''}{profile.address}
        </p>
      )}
      <div className="flex flex-wrap gap-3 mt-6">
        <Link href={`${base}/booking`}
          className={`px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity ${tpl.btnRadius}`}
          style={aStyle}>
          {ctaText}
        </Link>
        {properties.length > 0 && (
          <Link href={`${base}/rooms`}
            className={`px-6 py-3 text-sm font-semibold border-2 text-white hover:bg-white/10 transition-colors ${tpl.btnRadius}`}>
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
        style={{ minHeight: tpl.heroLayout === 'minimal' ? '50vh' : '70vh' }}>
        {heroImg ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImg} alt={profile.name}
              className="absolute inset-0 w-full h-full object-cover" />
            <div className={`absolute inset-0
              ${tpl.heroLayout === 'overlay-left'
                ? 'bg-gradient-to-r from-black/70 via-black/40 to-transparent'
                : tpl.heroLayout === 'minimal'
                  ? 'bg-black/20'
                  : 'bg-black/50'}`} />
          </>
        ) : (
          <div className="absolute inset-0" style={aStyle} />
        )}

        {tpl.heroLayout === 'minimal' ? (
          <div className="relative z-10 flex flex-col h-full" style={{ minHeight: '50vh' }}>
            <div className="flex-1" />
            <div className="bg-white/90 backdrop-blur max-w-5xl mx-auto w-full px-4 py-6 sm:py-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{profile.name}</h1>
              {profile.tagline && <p className="mt-1 text-gray-500">{profile.tagline}</p>}
              <div className="flex flex-wrap gap-3 mt-4">
                <Link href={`${base}/booking`}
                  className={`px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 ${tpl.btnRadius}`}
                  style={aStyle}>
                  {ctaText}
                </Link>
                {properties.length > 0 && (
                  <Link href={`${base}/rooms`}
                    className={`px-6 py-2.5 text-sm font-semibold border-2 hover:bg-gray-50 ${tpl.btnRadius}`}
                    style={aBorder}>
                    查看房型
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : heroContent}
      </section>

      {/* ── Quick badges ── */}
      <section className="bg-white border-b">
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
        <section className={`py-12 ${tpl.sectionAlt}`}>
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-end justify-between mb-6">
              <h2 className={`text-2xl font-bold text-gray-900 ${tpl.heroLayout === 'boutique' ? 'tracking-widest uppercase text-xl' : ''}`}>
                精選房型
              </h2>
              <Link href={`${base}/rooms`} className="text-sm hover:underline flex items-center gap-1" style={aText}>
                查看全部 <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.slice(0, 3).map(prop => {
                const img = (prop.images as string[] | null)?.[0]
                return (
                  <div key={prop.id} className={`bg-white overflow-hidden ${tpl.cardClass}`}>
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
                        <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                        {prop.base_price && (
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm" style={aText}>NT$ {fmt(prop.base_price)}</div>
                            <div className="text-[10px] text-gray-400">/ 晚</div>
                          </div>
                        )}
                      </div>
                      {prop.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{prop.description}</p>
                      )}
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />最多 {prop.max_guests ?? 2} 人
                      </div>
                      <Link href={`${base}/booking?room=${prop.id}`}
                        className={`block w-full text-center py-2 text-white text-sm font-semibold hover:opacity-90 transition-opacity ${tpl.btnRadius}`}
                        style={aStyle}>
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
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h2 className={`text-2xl font-bold text-gray-900 ${tpl.heroLayout === 'boutique' ? 'tracking-widest uppercase text-xl' : ''}`}>
                  關於我們
                </h2>
                <p className="text-gray-600 leading-relaxed line-clamp-5">
                  {profile.about || profile.description}
                </p>
                <Link href={`${base}/about`} className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" style={aText}>
                  了解更多 <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  {images.slice(1, 5).map((src, i) => (
                    <div key={i} className={`aspect-square overflow-hidden ${tpl.heroLayout === 'boutique' ? '' : 'rounded-xl'}`}>
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
      <section className={`py-8 border-t ${tpl.sectionAlt}`}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <h3 className="font-semibold text-gray-900">聯絡我們</h3>
            <div className="flex flex-wrap gap-3">
              {profile.phone && (
                <a href={`tel:${profile.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-white border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  <Phone className="h-4 w-4" style={aText} />{profile.phone}
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-white border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  <Mail className="h-4 w-4" style={aText} />{profile.email}
                </a>
              )}
              {profile.line_id && (
                <a href={`https://line.me/ti/p/~${profile.line_id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-white border rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
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
