import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('inv_settings')
    .select('variance_threshold, cup_code, tea_code, creamer_code, tea_per_cup, creamer_per_cup, expiry_remind_staff, expiry_remind_audit, expiry_remind_mgmt')
    .eq('owner_id', user.id).single()
  return NextResponse.json({
    variance_threshold: Number(data?.variance_threshold) || 10,
    cup_code: data?.cup_code ?? '', tea_code: data?.tea_code ?? '', creamer_code: data?.creamer_code ?? '',
    tea_per_cup: Number(data?.tea_per_cup) || 0, creamer_per_cup: Number(data?.creamer_per_cup) || 0,
    expiry_remind_staff: data?.expiry_remind_staff ?? 7,
    expiry_remind_audit: data?.expiry_remind_audit ?? 3,
    expiry_remind_mgmt: data?.expiry_remind_mgmt ?? 1,
  })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { owner_id: user.id, updated_at: new Date().toISOString() }
  if (body.variance_threshold !== undefined) patch.variance_threshold = Math.max(0, Number(body.variance_threshold) || 0)
  if (body.cup_code !== undefined) patch.cup_code = String(body.cup_code)
  if (body.tea_code !== undefined) patch.tea_code = String(body.tea_code)
  if (body.creamer_code !== undefined) patch.creamer_code = String(body.creamer_code)
  if (body.tea_per_cup !== undefined) patch.tea_per_cup = Math.max(0, Number(body.tea_per_cup) || 0)
  if (body.creamer_per_cup !== undefined) patch.creamer_per_cup = Math.max(0, Number(body.creamer_per_cup) || 0)
  if (body.expiry_remind_staff !== undefined) patch.expiry_remind_staff = Math.max(0, parseInt(String(body.expiry_remind_staff)) || 0)
  if (body.expiry_remind_audit !== undefined) patch.expiry_remind_audit = Math.max(0, parseInt(String(body.expiry_remind_audit)) || 0)
  if (body.expiry_remind_mgmt !== undefined) patch.expiry_remind_mgmt = Math.max(0, parseInt(String(body.expiry_remind_mgmt)) || 0)
  const { error } = await supabase.from('inv_settings').upsert(patch, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
