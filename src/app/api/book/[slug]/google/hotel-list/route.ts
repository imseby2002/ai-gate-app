import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadFeedProfile, xmlEscape } from '@/lib/booking/google-feed'

// Google Hotel Center「Hotel List Feed」: 單一民宿(slug)作為一間 hotel。
// 規格: https://developers.google.com/hotels/hotel-prices/dev-guide/hotel-list-feed
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()
  const profile = await loadFeedProfile(admin, slug)

  if (!profile || !profile.google_feed_enabled || profile.latitude == null || profile.longitude == null) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?>\n<listings>\n  <language>zh-TW</language>\n</listings>',
      { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  }

  const country = (profile.country || 'TW').toUpperCase()
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<listings>',
    '  <language>zh-TW</language>',
    '  <listing>',
    `    <id>${xmlEscape(slug)}</id>`,
    `    <name>${xmlEscape(profile.name || slug)}</name>`,
    '    <address format="simple">',
    profile.address ? `      <component name="addr1">${xmlEscape(profile.address)}</component>` : '',
    profile.city ? `      <component name="city">${xmlEscape(profile.city)}</component>` : '',
    `      <component name="country">${country}</component>`,
    '    </address>',
    `    <country>${country}</country>`,
    `    <latitude>${profile.latitude}</latitude>`,
    `    <longitude>${profile.longitude}</longitude>`,
    profile.phone ? `    <phone type="main">${xmlEscape(profile.phone)}</phone>` : '',
    '    <category>hotel</category>',
    '  </listing>',
    '</listings>',
  ].filter(Boolean)

  return new NextResponse(parts.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
