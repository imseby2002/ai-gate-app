import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron: 釋放逾時未確認的公開訂房（避免被囤占房態 / 釋放被遺忘的待確認單）
// 規則：status='pending' 且建立超過 STALE_HOURS 小時者 → 改為 'cancelled'
// 已收款（刷卡成功／轉帳已核對）的不自動取消，避免收了錢訂單卻被取消；待處理期間由 pending-booking-reminders 每天通知民宿主
const STALE_HOURS = 48

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString()

  const { data, error } = await supabase
    .from('public_bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .neq('payment_status', 'paid')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ released: data?.length ?? 0 })
}
