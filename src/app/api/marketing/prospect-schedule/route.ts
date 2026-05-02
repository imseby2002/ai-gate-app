/**
 * GET  /api/marketing/prospect-schedule  — 讀取排程設定
 * POST /api/marketing/prospect-schedule  — 儲存排程設定
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('prospect_schedules')
    .select('config, schedule, last_result, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { config, schedule } = body

  // Compute nextRunAt if schedule changed
  let scheduleToSave = { ...schedule }
  if (schedule?.enabled) {
    scheduleToSave.nextRunAt = computeNextRun(schedule).toISOString()
  }

  const { error } = await supabase
    .from('prospect_schedules')
    .upsert(
      { user_id: user.id, config, schedule: scheduleToSave },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nextRunAt: scheduleToSave.nextRunAt })
}

function computeNextRun(s: {
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday?: number
  monthDay?: number
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
