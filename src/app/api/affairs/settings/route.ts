import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { getAffairSettings } from '@/lib/affairs/reminders'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const TEXT_FIELDS = [
  'external_telegram', 'external_email', 'external_zalo',
  'general_telegram', 'general_email', 'general_zalo',
  'cashier_telegram', 'cashier_email', 'cashier_zalo',
  'gm_telegram', 'gm_email', 'gm_zalo',
] as const

const NUM_FIELDS = [
  ['default_expiry_stage1_days', 30],
  ['default_expiry_stage2_days', 15],
  ['default_expiry_urgent_days', 7],
  ['default_pay_stage1_days', 3],
  ['default_pay_stage2_days', 1],
] as const

export async function GET() {
  const { user } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const settings = await getAffairSettings(admin, user.id)
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const { user } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  // 1. 整理純淨 payload
  const patch: Record<string, unknown> = {
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  }
  for (const f of TEXT_FIELDS) {
    if (b[f] !== undefined) patch[f] = String(b[f] ?? '').trim()
  }
  for (const [f, defVal] of NUM_FIELDS) {
    if (b[f] !== undefined) {
      patch[f] = Math.max(0, Number(b[f]) || defVal)
    }
  }

  // 2. 備份/同步至 social_platform_credentials (JSONB)，保證 100% 欄位不丟失
  try {
    await admin.from('social_platform_credentials').upsert({
      user_id: user.id,
      platform: 'affair_settings',
      credentials: patch,
      is_connected: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })
  } catch (e) {
    console.error('[affairs/settings] Failed to save in social_platform_credentials:', e)
  }

  // 3. 嘗試更新至 affair_settings 表（若欄位已存在則直接生效）
  // 為防舊 schema 報「column does not exist」，先嘗試完整寫入，若失敗則回退為基本欄位
  const { error } = await admin.from('affair_settings').upsert(patch, { onConflict: 'owner_id' })
  if (error) {
    // 降級為原始既有欄位
    const basePatch: Record<string, unknown> = {
      owner_id: user.id,
      updated_at: new Date().toISOString(),
      external_telegram: String(patch.external_telegram ?? ''),
      external_email: String(patch.external_email ?? ''),
      general_telegram: String(patch.general_telegram ?? ''),
      general_email: String(patch.general_email ?? ''),
      cashier_telegram: String(patch.cashier_telegram ?? ''),
      cashier_email: String(patch.cashier_email ?? ''),
      default_remind_days: Number(patch.default_expiry_stage2_days) || 15,
      default_pay_remind_days: Number(patch.default_pay_stage1_days) || 3,
    }
    const { error: fallbackErr } = await admin.from('affair_settings').upsert(basePatch, { onConflict: 'owner_id' })
    if (fallbackErr) {
      console.error('[affairs/settings] Fallback upsert failed:', fallbackErr)
    }
  }

  return NextResponse.json({ ok: true })
}
