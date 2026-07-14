export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncEmailForSetting, syncAllEmailForUser } from '@/lib/booking/email-sync'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

export async function POST(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Email 同步為 CORE 以上方案功能
  const { features } = await getBookingEntitlements(supabase, ctx.ownerId)
  if (!features.emailSync) {
    return NextResponse.json({ error: '目前方案不支援 Email 同步，請升級方案。' }, { status: 403 })
  }

  const { setting_id, reset } = await req.json()
  const admin = createAdminClient()

  // reset=true: clear last_synced_at + delete null-property email bookings for this setting
  if (reset) {
    if (setting_id) {
      await admin.from('email_settings').update({ last_synced_at: null }).eq('id', setting_id).eq('user_id', ctx.ownerId)
    } else {
      await admin.from('email_settings').update({ last_synced_at: null }).eq('user_id', ctx.ownerId)
    }
    // Delete null-property email bookings so they get re-imported with correct property
    await admin.from('bookings').delete()
      .eq('user_id', ctx.ownerId)
      .eq('source', 'email')
      .is('property_id', null)
  }

  if (setting_id) {
    const result = await syncEmailForSetting(setting_id)
    return NextResponse.json({ results: [result] })
  }

  const results = await syncAllEmailForUser(ctx.ownerId)
  return NextResponse.json({ results })
}
