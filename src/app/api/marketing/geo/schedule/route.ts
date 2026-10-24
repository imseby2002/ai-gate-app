/**
 * GET/PUT /api/marketing/geo/schedule
 * GEO 自動巡航排程（每間公司一組）：每天或每週指定日自動產出一篇 GEO 文章。
 */
import { NextRequest, NextResponse } from 'next/server'
import { currentDataOwner } from '@/lib/company/profile'
import { SCHEDULE_DEFAULTS } from '@/lib/geo/autopilot-schedule'

const LOCALES = new Set(['zh-TW', 'en', 'vi'])

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await c.admin.from('geo_autopilot_schedules').select('*').eq('owner_id', c.ownerId).maybeSingle()
  return NextResponse.json({ schedule: data ?? { ...SCHEDULE_DEFAULTS, owner_id: c.ownerId, last_run_at: null, last_status: null } })
}

export async function PUT(req: NextRequest) {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))

  const weekdays = Array.isArray(b.weekdays)
    ? [...new Set((b.weekdays as unknown[]).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
    : SCHEDULE_DEFAULTS.weekdays
  const frequency = b.frequency === 'daily' ? 'daily' : 'weekly'
  if (frequency === 'weekly' && weekdays.length === 0) return NextResponse.json({ error: '請至少選擇一天' }, { status: 400 })
  const runHour = Number(b.run_hour)
  const topics = Array.isArray(b.topics)
    ? (b.topics as unknown[]).map(t => String(t ?? '').trim()).filter(Boolean).slice(0, 100)
    : []

  const row = {
    owner_id: c.ownerId,
    created_by: c.userId,
    enabled: !!b.enabled,
    frequency,
    weekdays,
    run_hour: Number.isInteger(runHour) && runHour >= 0 && runHour <= 23 ? runHour : SCHEDULE_DEFAULTS.run_hour,
    timezone: SCHEDULE_DEFAULTS.timezone,
    locale: LOCALES.has(b.locale) ? b.locale : SCHEDULE_DEFAULTS.locale,
    topics,
    auto_topics: b.auto_topics !== false,
    promo_focus: String(b.promo_focus ?? '').trim().slice(0, 500),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await c.admin.from('geo_autopilot_schedules').upsert(row, { onConflict: 'owner_id' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data })
}
