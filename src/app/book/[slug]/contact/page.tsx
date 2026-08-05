import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { Phone, Mail, MessageCircle, Globe, MapPin } from 'lucide-react'
import { resolveDesign, headingCss } from '@/lib/booking/templates'

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('name, theme_color, template_id, custom_design, phone, email, line_id, website, address, city, social_links, contact_map_embed, contact_note, check_in_time, check_out_time')
    .eq('slug', slug)
    .single()
  if (!profile) notFound()

  const design     = resolveDesign(profile)
  const accent     = design.accent
  const aText      = { color: accent }
  const headingStyle = headingCss(design)
  const mutedStyle   = { color: design.muted }
  const h1Size     = design.headingUppercase ? 'text-2xl' : 'text-3xl'
  const social     = (profile.social_links as Record<string, string> | null) ?? {}
  const contactNote = profile.contact_note as string | null
  const mapEmbed   = profile.contact_map_embed as string | null

  const contacts = [
    profile.phone    && { icon: Phone,         label: '電話',  value: profile.phone,    href: `tel:${profile.phone}` },
    profile.email    && { icon: Mail,           label: 'Email', value: profile.email,    href: `mailto:${profile.email}` },
    profile.line_id  && { icon: MessageCircle,  label: 'LINE',  value: profile.line_id,  href: `https://line.me/ti/p/~${profile.line_id}` },
    profile.website  && { icon: Globe,          label: '官網',  value: profile.website,  href: profile.website },
    profile.address  && { icon: MapPin,         label: '地址',  value: `${profile.city || ''}${profile.address}`, href: `https://maps.google.com/?q=${encodeURIComponent(`${profile.city || ''}${profile.address}`)}` },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string; href: string }[]

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className={h1Size} style={headingStyle}>
          聯絡我們
        </h1>
        {contactNote && (
          <p className="mt-3 text-sm leading-relaxed" style={mutedStyle}>{contactNote}</p>
        )}
      </div>

      {/* Contact cards */}
      {contacts.length > 0 && (
        <section className="grid sm:grid-cols-2 gap-3">
          {contacts.map((item, i) => {
            const Icon = item.icon
            return (
              <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 border transition-shadow group"
                style={{ backgroundColor: design.cardBg, borderColor: design.cardBorder, borderRadius: design.cardRadius, boxShadow: design.shadow || undefined }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}18` }}>
                  <Icon className="h-4 w-4" style={aText} />
                </div>
                <div>
                  <div className="text-[11px]" style={mutedStyle}>{item.label}</div>
                  <div className="text-sm font-medium" style={{ color: design.ink }}>{item.value}</div>
                </div>
              </a>
            )
          })}
        </section>
      )}

      {/* Business hours */}
      {(profile.check_in_time || profile.check_out_time) && (
        <section className="rounded-xl p-4 space-y-2" style={{ backgroundColor: design.sectionBg }}>
          <h2 className="text-sm font-semibold" style={{ color: design.ink }}>入住時間</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.check_in_time && (
              <div>
                <span className="text-xs" style={mutedStyle}>入住（Check-in）</span>
                <div className="font-semibold" style={{ color: design.ink }}>{profile.check_in_time} 後</div>
              </div>
            )}
            {profile.check_out_time && (
              <div>
                <span className="text-xs" style={mutedStyle}>退房（Check-out）</span>
                <div className="font-semibold" style={{ color: design.ink }}>{profile.check_out_time} 前</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Social links */}
      {(social.facebook || social.instagram || social.youtube) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">社群媒體</h2>
          <div className="flex flex-wrap gap-2">
            {social.facebook && (
              <a href={social.facebook} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Facebook
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Instagram
              </a>
            )}
            {social.youtube && (
              <a href={social.youtube} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                YouTube
              </a>
            )}
          </div>
        </section>
      )}

      {/* Map embed */}
      {mapEmbed && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">地圖</h2>
          <div className="w-full rounded-xl overflow-hidden border aspect-[16/9]">
            <iframe
              src={mapEmbed}
              width="100%" height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}
    </div>
  )
}
