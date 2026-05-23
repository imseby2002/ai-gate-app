import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ valid: false, error: '無效頁面' }, { status: 404 })

  const { code, num_nights, total_price } = await req.json()
  if (!code) return NextResponse.json({ valid: false, error: '請輸入優惠碼' })

  const { data: promo } = await admin.from('promo_codes')
    .select('*').eq('user_id', profile.user_id).eq('code', code.toUpperCase()).eq('enabled', true).single()

  if (!promo) return NextResponse.json({ valid: false, error: '優惠碼不存在或已停用' })

  const now = new Date().toISOString().slice(0, 10)
  if (promo.valid_from && promo.valid_from > now) return NextResponse.json({ valid: false, error: '優惠碼尚未生效' })
  if (promo.valid_to && promo.valid_to < now) return NextResponse.json({ valid: false, error: '優惠碼已過期' })
  if (promo.max_uses && promo.used_count >= promo.max_uses) return NextResponse.json({ valid: false, error: '優惠碼已達使用上限' })
  if (num_nights < (promo.min_nights ?? 1)) return NextResponse.json({ valid: false, error: `最少需訂 ${promo.min_nights} 晚` })
  if (promo.min_amount && total_price < promo.min_amount) return NextResponse.json({ valid: false, error: `訂單金額需達 NT$ ${promo.min_amount}` })

  const discount = promo.type === 'percent'
    ? Math.round(total_price * promo.value / 100)
    : Math.min(promo.value, total_price)

  return NextResponse.json({ valid: true, discount, type: promo.type, value: promo.value, name: promo.name })
}
