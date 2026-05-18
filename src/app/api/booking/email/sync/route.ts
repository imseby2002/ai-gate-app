import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncEmailForSetting, syncAllEmailForUser } from '@/lib/booking/email-sync'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setting_id } = await req.json()

  if (setting_id) {
    const result = await syncEmailForSetting(setting_id)
    return NextResponse.json({ results: [result] })
  }

  const results = await syncAllEmailForUser(user.id)
  return NextResponse.json({ results })
}
