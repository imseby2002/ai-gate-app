import { NextRequest, NextResponse } from 'next/server'
import { getCompanyContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getCompanyContext()
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 全公司基本時薪預設（薪資設定），單位可覆寫。
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('hr_settings').select('default_hourly_rate').eq('owner_id', user.id).single()
  return NextResponse.json({ default_hourly_rate: Number(data?.default_hourly_rate) || 0 })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const val = Math.max(0, Number(b.default_hourly_rate) || 0)
  const { error } = await supabase.from('hr_settings').upsert({ owner_id: user.id, default_hourly_rate: val, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
