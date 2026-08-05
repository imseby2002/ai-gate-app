import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BedDouble, Users, ChevronRight } from 'lucide-react'
import { resolveDesign, headingCss } from '@/lib/booking/templates'

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export default async function RoomsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('name, theme_color, template_id, custom_design, user_id')
    .eq('slug', slug)
    .single()
  if (!profile) notFound()

  const { data: properties } = await admin
    .from('properties')
    .select('*')
    .eq('user_id', profile.user_id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const design = resolveDesign(profile)
  const accent = design.accent
  const aStyle = { backgroundColor: accent }
  const aText  = { color: accent }
  const headingStyle = headingCss(design)
  const mutedStyle   = { color: design.muted }
  const btnStyle     = { borderRadius: design.btnRadius }
  const base   = `/book/${slug}`
  const h1Size = design.headingUppercase ? 'text-2xl' : 'text-3xl'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className={h1Size} style={headingStyle}>
          房型介紹
        </h1>
        <p className="text-sm mt-1" style={mutedStyle}>選擇最適合您的房型，直接線上預訂</p>
      </div>

      {properties && properties.length > 0 ? (
        <div className="space-y-8">
          {properties.map(prop => {
            const imgs = (prop.images as string[] | null) ?? []
            const amenities = (prop.amenities as string[] | null) ?? []
            return (
              <div key={prop.id} className="overflow-hidden border"
                style={{ backgroundColor: design.cardBg, borderColor: design.cardBorder, borderRadius: design.cardRadius, boxShadow: design.shadow || undefined }}>
                {/* Image */}
                <div className="aspect-[16/7] overflow-hidden bg-gray-100">
                  {imgs[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgs[0]} alt={prop.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BedDouble className="h-12 w-12 text-gray-200" />
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                {imgs.length > 1 && (
                  <div className="flex gap-1.5 px-4 pt-3">
                    {imgs.slice(1, 5).map((src, i) => (
                      <div key={i} className="w-16 h-12 rounded overflow-hidden bg-gray-100 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {/* Name + Price */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 style={{ ...headingStyle, fontSize: '1.25rem' }}>{prop.name}</h2>
                      {prop.description && (
                        <p className="text-sm mt-1 leading-relaxed" style={mutedStyle}>{prop.description}</p>
                      )}
                    </div>
                    {prop.base_price && (
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold" style={aText}>NT$ {fmt(prop.base_price)}</div>
                        <div className="text-xs" style={mutedStyle}>/ 晚</div>
                        {prop.extra_guest_fee && prop.extra_guest_fee > 0 && (
                          <div className="text-[11px] mt-0.5" style={mutedStyle}>超額 +NT$ {fmt(prop.extra_guest_fee)}/人晚</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Capacity */}
                  <div className="flex items-center gap-4 text-sm" style={mutedStyle}>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" style={aText} />
                      最多 {prop.max_guests ?? 2} 人
                    </span>
                    {prop.room_count > 1 && (
                      <span>{prop.room_count} 間</span>
                    )}
                  </div>

                  {/* Amenities */}
                  {amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {amenities.map(a => (
                        <span key={a} className="text-xs px-2.5 py-1 rounded-full border" style={mutedStyle}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <Link href={`${base}/booking?room=${prop.id}`}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 text-white text-sm font-bold hover:opacity-90 transition-opacity"
                    style={{ ...aStyle, ...btnStyle }}>
                    立即訂房 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <BedDouble className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>目前無可訂房型</p>
        </div>
      )}
    </div>
  )
}
