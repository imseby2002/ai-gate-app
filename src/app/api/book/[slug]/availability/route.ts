import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 公開查詢某房型未來的「不可訂日期」（已訂 + 封鎖），供前台日曆即時提示。
// 以 slug 綁定 host，且必須帶 property_id，避免跨民宿枚舉資料。
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const propertyId = new URL(req.url).searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ unavailable: [] })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10)

  const [{ data: pub }, { data: main }, { data: blocked }] = await Promise.all([
    admin.from('public_bookings').select('check_in, check_out')
      .eq('host_user_id', profile.user_id).eq('property_id', propertyId)
      .in('status', ['pending', 'confirmed']).lt('check_in', horizon).gte('check_out', today),
    admin.from('bookings').select('check_in, check_out')
      .eq('user_id', profile.user_id).eq('property_id', propertyId)
      .in('status', ['pending', 'confirmed']).lt('check_in', horizon).gte('check_out', today),
    admin.from('blocked_dates').select('date')
      .eq('user_id', profile.user_id).eq('property_id', propertyId)
      .gte('date', today).lt('date', horizon),
  ])

  const nights = new Set<string>()
  const addRange = (ci: string, co: string) => {
    const start = new Date(`${ci}T00:00:00Z`).getTime()
    const end = new Date(`${co}T00:00:00Z`).getTime()
    for (let t = start; t < end; t += 86400_000) {
      nights.add(new Date(t).toISOString().slice(0, 10))
    }
  }
  for (const b of pub ?? []) addRange(b.check_in, b.check_out)
  for (const b of main ?? []) addRange(b.check_in, b.check_out)
  for (const b of blocked ?? []) nights.add(b.date)

  return NextResponse.json({ unavailable: [...nights].sort() })
}
