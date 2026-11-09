import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_STORE } from '@/lib/reserve/mock-data'
import { getCurrentStore } from '@/lib/reserve/current-store'
import { getReserveEntitlements } from '@/lib/reserve/entitlements'

// 店家可自行修改的欄位（不含 id、user_id 等）
const EDITABLE = [
  'slug', 'name', 'category', 'description', 'phone', 'email', 'address', 'cover_url', 'logo_url',
  'business_hours', 'slot_interval_minutes', 'advance_booking_days', 'min_booking_hours', 'allow_any_staff',
  'deposit_required', 'deposit_amount', 'currency', 'notice', 'is_active',
  'sms_reminder_enabled', 'sms_reminder_hours', 'sms_reminder_template',
] as const

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ store: DEFAULT_STORE, isDemo: true })
    }

    const store = await getCurrentStore(user.id, req)
    if (!store) {
      return NextResponse.json({ store: { ...DEFAULT_STORE, user_id: user.id }, isDemo: true })
    }
    return NextResponse.json({ store, isDemo: false })
  } catch (err: unknown) {
    console.error('[reserve-store-get]', err)
    return NextResponse.json({ store: DEFAULT_STORE, isDemo: true })
  }
}

/** 儲存目前門市設定；還沒有門市時建立第一間 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const fields: Record<string, unknown> = {}
    for (const k of EDITABLE) if (k in body) fields[k] = body[k]
    if (typeof fields.slug === 'string') fields.slug = fields.slug.trim().toLowerCase()
    // 自訂簡訊內容限 CORE；FREE 一律使用預設內容
    if ('sms_reminder_template' in fields && !(await getReserveEntitlements(user.id)).features.customSmsTemplate) delete fields.sms_reminder_template

    const admin = createAdminClient()
    const current = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)
    const now = new Date().toISOString()
    const { data, error } = current
      ? await admin.from('reserve_stores').update({ ...fields, updated_at: now }).eq('id', current.id).eq('user_id', user.id).select().single()
      : await admin.from('reserve_stores').insert({
          name: '我的預約門市', slug: `store-${user.id.slice(0, 8)}`, ...fields, user_id: user.id, updated_at: now,
        }).select().single()

    if (error) {
      const msg = error.code === '23505' ? '這個預約網址已被使用，請換一個' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ store: data })
  } catch (err: unknown) {
    console.error('[reserve-store-post]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
