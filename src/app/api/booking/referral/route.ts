import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateReferralCode } from '@/lib/booking/referral'

// GET /api/booking/referral — 取得（或產生）自己的推薦碼與成功推薦人數
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const code = await getOrCreateReferralCode(admin, user.id)

  const { count } = await admin
    .from('booking_referral_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)

  return NextResponse.json({ code, referredCount: count ?? 0 })
}
