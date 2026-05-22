import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, num_nights = 1, total_price = 0 } = await req.json()
  if (!code) return NextResponse.json({ valid: false, error: '請輸入優惠碼' })

  const { data: promo } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('user_id', user.id)
    .eq('code', code.trim().toUpperCase())
    .eq('enabled', true)
    .maybeSingle()

  if (!promo) return NextResponse.json({ valid: false, error: '優惠碼不存在或已停用' })

  const today = new Date().toISOString().slice(0, 10)
  if (promo.valid_from && promo.valid_from > today)
    return NextResponse.json({ valid: false, error: `優惠碼尚未生效（${promo.valid_from} 起）` })
  if (promo.valid_to && promo.valid_to < today)
    return NextResponse.json({ valid: false, error: '優惠碼已過期' })
  if (promo.max_uses && promo.used_count >= promo.max_uses)
    return NextResponse.json({ valid: false, error: '優惠碼已達使用次數上限' })
  if (num_nights < promo.min_nights)
    return NextResponse.json({ valid: false, error: `需入住至少 ${promo.min_nights} 晚才適用` })
  if (promo.min_amount && total_price < promo.min_amount)
    return NextResponse.json({ valid: false, error: `訂單金額需達 NT$ ${promo.min_amount} 才適用` })

  const discount = promo.type === 'percent'
    ? Math.round(total_price * promo.value / 100)
    : Math.min(Number(promo.value), total_price)

  return NextResponse.json({ valid: true, discount, type: promo.type, value: promo.value, name: promo.name })
}
