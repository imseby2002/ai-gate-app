import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron: 釋放逾時未確認的公開訂房（避免被囤占房態 / 釋放被遺忘的待確認單）
// 規則：status='pending' 且建立超過 STALE_HOURS 小時者 → 改為 'cancelled'
// 信用卡訂單不自動取消（可能已扣款或待人工處理），改由 card-payment-reminders 每天通知民宿主人工處理
const STALE_HOURS = 48

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
  const cutoff = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString()

  const { data, error } = await supabase
    .from('public_bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .or('payment_method.is.null,payment_method.neq.card')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ released: data?.length ?? 0 })
}
