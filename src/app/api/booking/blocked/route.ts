import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')
  const property_id = sp.get('property_id')

  let q = supabase
    .from('blocked_dates')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .eq('reason', 'owner_block')

  if (from)        q = q.gte('date', from)
  if (to)          q = q.lte('date', to)
  if (property_id) q = q.eq('property_id', property_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocked: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json({ error: '檢視者無法修改' }, { status: 403 })

  const { property_id, dates } = await req.json()
  if (!property_id || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  // 唯一鍵是 (user_id, property_id, date, ical_setting_id)，手動關房的 ical_setting_id 為 null，
  // 無法用 upsert onConflict，改為先查已存在的日期、只新增缺的。
  const { data: existing, error: selErr } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('user_id', ctx.ownerId)
    .eq('property_id', property_id)
    .eq('reason', 'owner_block')
    .in('date', dates)
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  const have = new Set((existing ?? []).map((r: { date: string }) => r.date))
  const missing = (dates as string[]).filter(d => !have.has(d))
  if (missing.length === 0) return NextResponse.json({ ok: true })

  const rows = missing.map((d: string) => ({
    user_id: ctx.ownerId,
    property_id,
    date: d,
    reason: 'owner_block',
    platform: 'manual',
    ical_setting_id: null,
    booking_id: null,
  }))

  const { error } = await supabase
    .from('blocked_dates')
    .insert(rows)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canWrite) return NextResponse.json({ error: '檢視者無法修改' }, { status: 403 })

  const { property_id, dates } = await req.json()
  if (!property_id || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('user_id', ctx.ownerId)
    .eq('property_id', property_id)
    .eq('reason', 'owner_block')
    .in('date', dates)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
