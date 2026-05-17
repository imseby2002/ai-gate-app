import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncICalForSetting, syncAllICalForUser } from '@/lib/booking/ical-sync'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setting_id } = await req.json().catch(() => ({}))

  if (setting_id) {
    // Sync single iCal setting
    const result = await syncICalForSetting(setting_id)
    return NextResponse.json({ results: [result] })
  } else {
    // Sync all for this user
    const results = await syncAllICalForUser(user.id)
    return NextResponse.json({ results })
  }
}
