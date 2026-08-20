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

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('inv_settings')
    .select('variance_threshold, cup_code, tea_code, creamer_code, tea_per_cup, creamer_per_cup')
    .eq('owner_id', user.id).single()
  return NextResponse.json({
    variance_threshold: Number(data?.variance_threshold) || 10,
    cup_code: data?.cup_code ?? '', tea_code: data?.tea_code ?? '', creamer_code: data?.creamer_code ?? '',
    tea_per_cup: Number(data?.tea_per_cup) || 0, creamer_per_cup: Number(data?.creamer_per_cup) || 0,
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
  const { error } = await supabase.from('inv_settings').upsert(patch, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
