/**
 * GET /api/marketing/plan — 目前帳號的行銷方案與解析後權限（給前端鎖定 UI 用）
 * Infinity 無法進 JSON，序列化為 null（前端視為無限）。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { MONTHLY_GIFT_CREDITS, PLAN_COST_MULTIPLIER, getMonthlyGiftAllowance, getMonthlyGiftRemaining } from '@/lib/marketing/billing'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  const serialized = Object.fromEntries(
    Object.entries(features).map(([k, v]) => [k, v === Infinity ? null : v]),
  )
  // 每月贈點（當月用完即止）：FREE 需完成 Email 驗證才發放
  const [allowance, remaining] = await Promise.all([getMonthlyGiftAllowance(user.id), getMonthlyGiftRemaining(user.id)])
  return NextResponse.json({
    plan,
    features: serialized,
    costMultiplier: PLAN_COST_MULTIPLIER[plan],
    monthlyGift: {
      planAllowance: MONTHLY_GIFT_CREDITS[plan],
      allowance,
      remaining,
      emailVerified: !!user.email_confirmed_at,
    },
  })
}
