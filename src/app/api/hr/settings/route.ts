import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const DEFAULTS = { insurance_mode: 'threshold', insurance_threshold: 5000000, insurance_currency: 'VND' }

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('hr_settings').select('*').eq('owner_id', user.id).single()
  return NextResponse.json({ settings: data ?? { owner_id: user.id, ...DEFAULTS } })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const insurance_mode = body.insurance_mode === 'all' ? 'all' : 'threshold'
  const insurance_threshold = Number(body.insurance_threshold) || 0
  const insurance_currency = String(body.insurance_currency ?? 'VND').trim() || 'VND'

  const { data, error } = await supabase
    .from('hr_settings')
    .upsert({
      owner_id: user.id, insurance_mode, insurance_threshold, insurance_currency,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
