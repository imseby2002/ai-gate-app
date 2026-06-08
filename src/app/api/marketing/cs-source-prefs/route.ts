import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

const DEFAULTS = { priceSource: 'booking_system', passwordSource: 'booking_system', checkinTime: '' }

// AI 客服資料來源偏好（價格／密碼各自切換訂單系統或客服自建資料），存於 cs_data_sources type=source_prefs。
export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('cs_data_sources')
    .select('config')
    .eq('user_id', ctx.ownerId)
    .eq('type', 'source_prefs')
    .maybeSingle()

  return NextResponse.json({ prefs: { ...DEFAULTS, ...(data?.config ?? {}) } })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rawTime = typeof body.checkinTime === 'string' ? body.checkinTime.trim().slice(0, 5) : ''
  const config = {
    priceSource: body.priceSource === 'pricing_calculator' ? 'pricing_calculator' : 'booking_system',
    passwordSource: body.passwordSource === 'datasource' ? 'datasource' : 'booking_system',
    checkinTime: /^\d{2}:\d{2}$/.test(rawTime) ? rawTime : '',
  }

  const { data: existing } = await supabase
    .from('cs_data_sources')
    .select('id')
    .eq('user_id', ctx.ownerId)
    .eq('type', 'source_prefs')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cs_data_sources')
      .update({ config, enabled: true })
      .eq('id', existing.id).eq('user_id', ctx.ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('cs_data_sources')
      .insert({ user_id: ctx.ownerId, name: '資料來源偏好', type: 'source_prefs', config, enabled: true, industry: 'homestay' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prefs: config })
}
