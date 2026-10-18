import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 付款結果頁查詢：只回傳付款／訂房狀態，不含個資
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = createAdminClient()
  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: pb } = await admin.from('public_bookings')
    .select('payment_method, payment_status, status')
    .eq('host_user_id', profile.user_id).eq('confirmation_code', code).maybeSingle()
  if (!pb) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(pb)
}
