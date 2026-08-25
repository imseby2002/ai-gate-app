import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
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
