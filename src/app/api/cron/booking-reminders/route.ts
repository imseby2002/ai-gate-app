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
    supabase.from('bookings').select('id, user_id, order_id').eq('status', 'confirmed').eq('check_in', tomorrow),
    supabase.from('bookings').select('id, user_id, order_id').eq('status', 'confirmed').eq('check_out', today),
  ])

  // 提醒信/退房信內容本來就不分房型（只提醒時間、地址），同一張訂單訂了多間房
  // 時，同一位旅客只需要收到一封，不用每間房各寄一封幾乎一樣的信——依 order_id
  // 分組，一組只實際寄一次；但每一間房各自的寄送紀錄都要標記，避免之後被誤判
  // 成「這間房還沒寄過」而重寄。
  async function run(rows: { id: string; user_id: string; order_id: string | null }[] | null, type: NotificationType) {
    let sent = 0
    const groups = new Map<string, { id: string; user_id: string }[]>()
    for (const b of rows ?? []) {
      const key = `${b.user_id}:${b.order_id ?? b.id}`
      const arr = groups.get(key) ?? []
      arr.push({ id: b.id, user_id: b.user_id })
      groups.set(key, arr)
    }

    for (const group of groups.values()) {
      const ids = group.map(g => g.id)
      const { data: already } = await supabase
        .from('booking_notifications')
        .select('booking_id').eq('type', type).eq('status', 'sent').in('booking_id', ids)
      const alreadyIds = new Set((already ?? []).map(r => r.booking_id))
      const pending = group.filter(g => !alreadyIds.has(g.id))
      if (pending.length === 0) continue

      const r = await sendBookingNotification(supabase, pending[0].user_id, pending[0].id, type)
      if (r.ok) {
        sent++
        const rest = pending.slice(1)
        if (rest.length) {
          await supabase.from('booking_notifications').insert(
            rest.map(b => ({ user_id: b.user_id, booking_id: b.id, type, sent_to: r.sentTo, status: 'sent' })),
          )
        }
      }
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
