import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncEmailForSetting, syncAllEmailForUser } from '@/lib/booking/email-sync'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setting_id, reset } = await req.json()
  const admin = createAdminClient()

  // reset=true: clear last_synced_at + delete null-property email bookings for this setting
  if (reset) {
    if (setting_id) {
      await admin.from('email_settings').update({ last_synced_at: null }).eq('id', setting_id).eq('user_id', user.id)
    } else {
      await admin.from('email_settings').update({ last_synced_at: null }).eq('user_id', user.id)
    }
    // Delete null-property email bookings so they get re-imported with correct property
    await admin.from('bookings').delete()
      .eq('user_id', user.id)
      .eq('source', 'email')
      .is('property_id', null)
  }

  if (setting_id) {
    const result = await syncEmailForSetting(setting_id)
    return NextResponse.json({ results: [result] })
  }

  const results = await syncAllEmailForUser(user.id)
  return NextResponse.json({ results })
}
