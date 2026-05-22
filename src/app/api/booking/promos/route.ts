import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ promos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { code, name = '', type, value, min_nights = 1, min_amount, valid_from, valid_to, max_uses, enabled = true } = body
  if (!code || !type || value == null) return NextResponse.json({ error: '必填欄位缺少' }, { status: 400 })

  const { data, error } = await supabase
    .from('promo_codes')
    .insert({ user_id: user.id, code: code.trim().toUpperCase(), name, type, value, min_nights, min_amount: min_amount || null, valid_from: valid_from || null, valid_to: valid_to || null, max_uses: max_uses || null, enabled })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ promo: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })
  if (rest.code) rest.code = rest.code.trim().toUpperCase()
  if (rest.min_amount === '') rest.min_amount = null
  if (rest.valid_from === '') rest.valid_from = null
  if (rest.valid_to === '') rest.valid_to = null
  if (rest.max_uses === '' || rest.max_uses === 0) rest.max_uses = null

  const { data, error } = await supabase
    .from('promo_codes')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ promo: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('promo_codes').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
