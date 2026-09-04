import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const DEFAULTS = { insurance_mode: 'threshold', insurance_threshold: 5000000, insurance_currency: 'VND' }

export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { data } = await supabase.from('hr_settings').select('*').eq('owner_id', user.id).single()
  return NextResponse.json({ settings: data ?? { owner_id: user.id, ...DEFAULTS } })
}

export async function PUT(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const patch: Record<string, unknown> = { owner_id: user.id, updated_at: new Date().toISOString() }

  // 保險設定：僅在有帶時才更新，避免只切通知偏好卻覆蓋保險設定
  if (body.insurance_mode !== undefined) patch.insurance_mode = body.insurance_mode === 'all' ? 'all' : 'threshold'
  if (body.insurance_threshold !== undefined) patch.insurance_threshold = Number(body.insurance_threshold) || 0
  if (body.insurance_currency !== undefined) patch.insurance_currency = String(body.insurance_currency ?? 'VND').trim() || 'VND'
  if (body.notify_telegram !== undefined) patch.notify_telegram = !!body.notify_telegram
  if (body.notify_email !== undefined) patch.notify_email = !!body.notify_email

  const { data, error } = await supabase
    .from('hr_settings')
    .upsert(patch, { onConflict: 'owner_id' })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
