import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { syncICalForSetting, syncAllICalForUser } from '@/lib/booking/ical-sync'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setting_id, force = true } = await req.json().catch(() => ({}))

  if (setting_id) {
    // Sync single iCal setting
    const result = await syncICalForSetting(setting_id, { force: Boolean(force) })
    return NextResponse.json({ results: [result] })
  } else {
    // Sync all for this user / bnb owner
    const results = await syncAllICalForUser(ctx.ownerId, { force: Boolean(force) })
    return NextResponse.json({ results })
  }
}

