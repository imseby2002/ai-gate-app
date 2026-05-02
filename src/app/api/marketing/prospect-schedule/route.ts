/**
 * GET  /api/marketing/prospect-schedule  — 讀取排程設定
 * POST /api/marketing/prospect-schedule  — 儲存排程設定
 *
 * 直接沿用 marketing_campaigns 表：
 * 每個 user 有一筆 title='__prospect__' 的特殊 campaign，
 * 排程存在 unit_data._schedule，設定存在 unit_data._prospectConfig
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PROSPECT_TITLE = '__prospect__'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('id, unit_data, updated_at')
    .eq('user_id', user.id)
    .eq('title', PROSPECT_TITLE)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unitData = (data?.unit_data ?? {}) as Record<string, unknown>
  return NextResponse.json({
    data: {
      schedule:    unitData._schedule    ?? null,
      config:      unitData._prospectConfig ?? null,
      last_result: unitData._prospectResult ?? null,
      updated_at:  data?.updated_at ?? null,
    }
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { config, schedule } = await req.json()

  // Compute nextRunAt
  let scheduleToSave = { ...schedule }
  if (schedule?.enabled) {
    scheduleToSave.nextRunAt = computeNextRun(schedule).toISOString()
  }

  // Upsert by title
  const { data: existing } = await supabase
    .from('marketing_campaigns')
    .select('id, unit_data')
    .eq('user_id', user.id)
    .eq('title', PROSPECT_TITLE)
    .maybeSingle()

  const unitData = {
    ...((existing?.unit_data ?? {}) as Record<string, unknown>),
    _schedule:       scheduleToSave,
    _prospectConfig: config,
  }

  let error
  if (existing?.id) {
    ;({ error } = await supabase
      .from('marketing_campaigns')
      .update({ unit_data: unitData })
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase
      .from('marketing_campaigns')
      .insert({ user_id: user.id, title: PROSPECT_TITLE, unit_data: unitData }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nextRunAt: scheduleToSave.nextRunAt })
}

function computeNextRun(s: {
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number; minute: number
  weekday?: number; monthDay?: number
}): Date {
  const now = new Date()
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(s.minute ?? 0)
  next.setHours(s.hour ?? 8)

  if (s.frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (s.frequency === 'weekly') {
    const target = s.weekday ?? 1
    const diff = (target - next.getDay() + 7) % 7 || 7
    next.setDate(next.getDate() + diff)
    if (next <= now) next.setDate(next.getDate() + 7)
  } else if (s.frequency === 'monthly') {
    const d = s.monthDay ?? 1
    next.setDate(d)
    if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(d) }
  }
  return next
}
