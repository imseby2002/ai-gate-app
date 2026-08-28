import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const FIELDS = [
  'external_telegram', 'external_email', 'general_telegram', 'general_email',
  'cashier_telegram', 'cashier_email',
] as const

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('affair_settings').select('*').eq('owner_id', user.id).single()
  const out: Record<string, unknown> = {
    default_remind_days: Number(data?.default_remind_days) || 30,
    default_pay_remind_days: Number(data?.default_pay_remind_days) || 5,
  }
  for (const f of FIELDS) out[f] = data?.[f] ?? ''
  return NextResponse.json(out)
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { owner_id: user.id, updated_at: new Date().toISOString() }
  for (const f of FIELDS) if (b[f] !== undefined) patch[f] = String(b[f]).trim()
  if (b.default_remind_days !== undefined) patch.default_remind_days = Math.max(0, Number(b.default_remind_days) || 0)
  if (b.default_pay_remind_days !== undefined) patch.default_pay_remind_days = Math.max(0, Number(b.default_pay_remind_days) || 0)
  const { error } = await supabase.from('affair_settings').upsert(patch, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
