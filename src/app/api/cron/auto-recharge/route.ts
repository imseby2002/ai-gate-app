import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeBoundCardBackground, generateTradeNo } from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'

// Vercel Cron：找出「低於門檻自動儲值」已啟用、已綁卡、餘額低於門檻的用戶，觸發背景扣款。
// ECPAY_BACKGROUND_CHARGE_ENABLED 預設關閉（見 lib/ecpay/client.ts 的說明：幕後交易端點尚待
// 對照綠界官方文件核對），關閉時僅記錄「需要客戶手動儲值」，不會嘗試真的扣款。
const RETRY_COOLDOWN_MS = 60 * 60 * 1000 // 同一用戶 1 小時內最多觸發一次，避免重複扣款

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

  const admin = createAdminClient()
  const backgroundChargeEnabled = process.env.ECPAY_BACKGROUND_CHARGE_ENABLED === 'true'

  const { data: settingsRows } = await admin
    .from('auto_recharge_settings')
    .select('user_id, threshold_usd, recharge_usd, last_triggered_at')
    .eq('enabled', true)

  if (!settingsRows?.length) return NextResponse.json({ checked: 0, triggered: 0 })

  let triggered = 0
  const now = Date.now()

  for (const s of settingsRows) {
    if (s.last_triggered_at && now - new Date(s.last_triggered_at).getTime() < RETRY_COOLDOWN_MS) continue

    const { data: balance } = await admin.rpc('get_credit_balance', { p_user_id: s.user_id })
    if ((balance ?? 0) >= Number(s.threshold_usd)) continue

    const { data: binding } = await admin
      .from('ecpay_card_bindings')
      .select('merchant_member_id')
      .eq('user_id', s.user_id).eq('status', 'active').maybeSingle()
    if (!binding) continue

    triggered++

    if (!backgroundChargeEnabled) {
      // 安全預設：尚未核對幕後交易端點前，不嘗試真的扣款，只記錄狀態供客服/客戶自行處理
      console.warn('[AutoRecharge] 背景扣款功能未開通，需客戶手動儲值', { userId: s.user_id, balance })
      await admin.from('auto_recharge_settings').update({
        last_triggered_at: new Date().toISOString(),
        last_attempt_status: 'pending_manual',
      }).eq('user_id', s.user_id)
      continue
    }

    try {
      const rechargeUsd = Number(s.recharge_usd)
      const { twd } = await usdToTwdInteger(rechargeUsd)
      const tradeNo = generateTradeNo(s.user_id)
      const { url, params } = await chargeBoundCardBackground({
        merchantMemberId: binding.merchant_member_id,
        totalAmountTwd: twd,
        merchantTradeNo: tradeNo,
        itemName: `AI GATE 自動儲值 $${rechargeUsd}`,
      })
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(15000),
      })
      const text = await res.text()
      const ok = /RtnCode=1(&|$)/.test(text) || /"RtnCode":\s*1/.test(text)

      if (ok) {
        const { data: currentBalance } = await admin.rpc('get_credit_balance', { p_user_id: s.user_id })
        const newBalance = (currentBalance ?? 0) + rechargeUsd
        await admin.from('credit_transactions').insert({
          user_id: s.user_id,
          amount_usd: rechargeUsd,
          type: 'purchase',
          description: `低於門檻自動儲值（${tradeNo}）`,
          balance_after: newBalance,
        })
        await admin.from('auto_recharge_settings').update({
          last_triggered_at: new Date().toISOString(),
          last_attempt_status: 'success',
        }).eq('user_id', s.user_id)
      } else {
        console.error('[AutoRecharge] 背景扣款失敗', { userId: s.user_id, response: text })
        await admin.from('auto_recharge_settings').update({
          last_triggered_at: new Date().toISOString(),
          last_attempt_status: 'failed',
        }).eq('user_id', s.user_id)
      }
    } catch (err) {
      console.error('[AutoRecharge] 背景扣款發生例外', err)
      await admin.from('auto_recharge_settings').update({
        last_triggered_at: new Date().toISOString(),
        last_attempt_status: 'failed',
      }).eq('user_id', s.user_id)
    }
  }

  return NextResponse.json({ checked: settingsRows.length, triggered, backgroundChargeEnabled })
}
