import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .order('priority', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, rule_type, enabled = true,
    adjustment_type = 'percent', adjustment_value = 0,
    conditions = {}, priority = 0, property_id = null,
  } = body

  if (!name?.trim() || !rule_type)
    return NextResponse.json({ error: '名稱和類型必填' }, { status: 400 })

  const { features } = await getBookingEntitlements(supabase, ctx.ownerId)
  if (!features.dynamicPricing) {
    return NextResponse.json({ error: '目前方案不支援動態定價規則，請升級方案。' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pricing_rules')
    .insert({ user_id: ctx.ownerId, name, rule_type, enabled, adjustment_type, adjustment_value, conditions, priority, property_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('pricing_rules')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await supabase
    .from('pricing_rules')
    .delete()
    .eq('id', id).eq('user_id', ctx.ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
