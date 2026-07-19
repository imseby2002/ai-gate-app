import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MIN_RECHARGE_USD = 5

// 取得目前「低於門檻自動儲值」設定＋是否已綁卡
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const [{ data: settings }, { data: binding }] = await Promise.all([
    admin.from('auto_recharge_settings').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('ecpay_card_bindings').select('id, card_last4, status').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  return NextResponse.json({
    settings: settings ?? { enabled: false, threshold_usd: 5, recharge_usd: 10 },
    hasBoundCard: !!binding,
    cardLast4: binding?.card_last4 ?? null,
  })
}

// 更新門檻／金額／開關。啟用前必須已綁卡（見 /api/billing/create-binding-checkout）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled, thresholdUsd, rechargeUsd } = await req.json() as {
    enabled: boolean; thresholdUsd: number; rechargeUsd: number
  }

  if (!Number.isFinite(thresholdUsd) || thresholdUsd < 0) {
    return NextResponse.json({ error: '門檻金額不正確' }, { status: 400 })
  }
  if (!Number.isFinite(rechargeUsd) || rechargeUsd < MIN_RECHARGE_USD) {
    return NextResponse.json({ error: `自動儲值金額最低 $${MIN_RECHARGE_USD} 美金` }, { status: 400 })
  }

  const admin = await createAdminClient()

  if (enabled) {
    const { data: binding } = await admin
      .from('ecpay_card_bindings')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!binding) {
      return NextResponse.json({ error: '請先完成信用卡綁定才能開啟自動儲值' }, { status: 400 })
    }
  }

  await admin.from('auto_recharge_settings').upsert({
    user_id: user.id,
    enabled,
    threshold_usd: thresholdUsd,
    recharge_usd: rechargeUsd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
