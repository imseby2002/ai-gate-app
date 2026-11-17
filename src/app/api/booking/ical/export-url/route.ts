import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { propertyIcalUrl } from '@/lib/booking/ical-export'

// 後台取得每間房的 iCal 匯出連結（貼到各平台「匯入行事曆」用）。
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties').select('id, name, ical_export_token')
    .eq('user_id', ctx.ownerId).eq('status', 'active').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const origin = req.nextUrl.origin
  const feeds = (data ?? []).map(p => ({
    property_id: p.id, name: p.name, url: propertyIcalUrl(origin, p.ical_export_token),
  }))
  return NextResponse.json({ feeds })
}
