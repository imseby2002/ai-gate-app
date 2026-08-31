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

  const { data: stores, error } = await supabase
    .from('finance_stores')
    .select(`
      id, store_code, store_name, water_code, power_code, gas_code, ice_vendor_id, created_at,
      ice_vendor:finance_vendors!ice_vendor_id(id, vendor_name)
    `)
    .eq('owner_id', user.id)
    .order('store_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stores: stores ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const store_code = String(body.store_code ?? '').trim()
  if (!store_code) return NextResponse.json({ error: '門市編碼必填' }, { status: 400 })

  const payload = {
    owner_id: user.id,
    store_code,
    store_name: String(body.store_name ?? '').trim(),
    water_code: String(body.water_code ?? '').trim(),
    power_code: String(body.power_code ?? '').trim(),
    gas_code: String(body.gas_code ?? '').trim(),
    ice_vendor_id: body.ice_vendor_id || null,
  }

  const { data, error } = await supabase
    .from('finance_stores')
    .upsert(payload, { onConflict: 'owner_id,store_code' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { store_code } = await req.json().catch(() => ({}))
  if (!store_code) return NextResponse.json({ error: 'store_code required' }, { status: 400 })

  const { error } = await supabase
    .from('finance_stores')
    .delete()
    .eq('owner_id', user.id)
    .eq('store_code', store_code)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
