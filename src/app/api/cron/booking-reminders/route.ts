import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingNotification, type NotificationType } from '@/lib/booking/notify'

// Vercel Cron: 每日寄送入住提醒（明日入住）與退房提醒（今日退房）
// 以台灣時區判定日期；已寄過的同類型通知不重寄。
function taipeiDate(offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 86400_000)
  return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const today = taipeiDate(0)
  const tomorrow = taipeiDate(1)

  // 明日入住 → reminder；今日退房 → checkout
  const [{ data: reminders }, { data: checkouts }] = await Promise.all([
    supabase.from('bookings').select('id, user_id').eq('status', 'confirmed').eq('check_in', tomorrow),
    supabase.from('bookings').select('id, user_id').eq('status', 'confirmed').eq('check_out', today),
  ])

  async function run(rows: { id: string; user_id: string }[] | null, type: NotificationType) {
    let sent = 0
    for (const b of rows ?? []) {
      // 去重：同訂單同類型已成功寄過就略過
      const { data: prev } = await supabase
        .from('booking_notifications')
        .select('id').eq('booking_id', b.id).eq('type', type).eq('status', 'sent').limit(1)
      if (prev && prev.length) continue
      const r = await sendBookingNotification(supabase, b.user_id, b.id, type)
      if (r.ok) sent++
    }
    return sent
  }

  const [reminderSent, checkoutSent] = await Promise.all([
    run(reminders, 'reminder'),
    run(checkouts, 'checkout'),
  ])

  return NextResponse.json({
    reminders: { matched: reminders?.length ?? 0, sent: reminderSent },
    checkouts: { matched: checkouts?.length ?? 0, sent: checkoutSent },
  })
}
