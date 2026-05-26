import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBookingNotification, type NotificationType } from '@/lib/booking/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { booking_id, type = 'confirmation', to_override } = await req.json()
  if (!booking_id) return NextResponse.json({ error: 'booking_id 必填' }, { status: 400 })

  const result = await sendBookingNotification(supabase, user.id, booking_id, type as NotificationType, to_override)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, sent_to: result.sentTo })
}
