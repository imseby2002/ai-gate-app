import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 旅客回報轉帳帳號末五碼（公開端點）：以確認碼 + 訂房 Email 比對，避免被亂改別人的訂單
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { code, email, last5 } = await req.json().catch(() => ({})) as { code?: string; email?: string; last5?: string }
  if (!code || !email || !/^\d{5}$/.test(last5 ?? '')) {
    return NextResponse.json({ error: '請輸入帳號末五碼（5 位數字）' }, { status: 400 })
  }

  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pb } = await admin.from('public_bookings')
    .select('id, guest_email, payment_status')
    .eq('host_user_id', profile.user_id).eq('confirmation_code', code).maybeSingle()
  if (!pb || (pb.guest_email ?? '').toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: '找不到這筆訂房' }, { status: 404 })
  }
  if (pb.payment_status === 'paid') return NextResponse.json({ ok: true })

  const { error } = await admin.from('public_bookings')
    .update({ transfer_last5: last5, payment_status: 'reported' }).eq('id', pb.id)
  if (error) return NextResponse.json({ error: '回報失敗，請稍後再試' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
