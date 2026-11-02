import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listCsGiftCoupons } from '@/lib/esim/cs-gift'

// CS 設定頁「議價折扣與贈品/賠禮」選 eSIM 優惠用：只列 eSIM 後台授權給目前帳號的範本券
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('email, is_active').eq('id', user.id).single()
  if (profile?.is_active === false) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const email = String(profile?.email || user.email || '')
  try {
    return NextResponse.json({ coupons: await listCsGiftCoupons(email) })
  } catch {
    return NextResponse.json({ coupons: [] })
  }
}
