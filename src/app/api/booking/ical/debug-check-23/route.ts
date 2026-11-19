import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, ical_export_token')

  const { data: icalSettings } = await supabase
    .from('ical_settings')
    .select('id, platform, platform_name, ical_url, property_id, properties(name)')

  return NextResponse.json({
    properties,
    icalSettings,
  })
}

