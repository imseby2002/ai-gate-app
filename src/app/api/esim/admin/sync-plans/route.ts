import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEsimSettings, saveEsimSettings } from '@/lib/esim/db'
import {
  microEsimClient, PLANS_SYNC_SETTINGS_KEY, DEFAULT_PLANS_SYNC_SETTINGS, PlansSyncSettings,
} from '@/lib/esim/microesim'

export const maxDuration = 60

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/** GET：上次同步時間、方案數與自動同步設定 */
export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError
  const [info, schedule] = await Promise.all([
    microEsimClient.getLastSyncInfo(),
    getEsimSettings<PlansSyncSettings>(PLANS_SYNC_SETTINGS_KEY, DEFAULT_PLANS_SYNC_SETTINGS),
  ])
  return NextResponse.json({ success: true, ...info, schedule })
}

/** PUT：儲存自動同步設定 { interval_days: 0|1|3|7|14|30, hour: 0–23（台灣時間） } */
export async function PUT(req: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError
  const body = await req.json().catch(() => ({}))
  const interval = Number(body.interval_days)
  const hour = Number(body.hour)
  if (![0, 1, 3, 7, 14, 30].includes(interval) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return NextResponse.json({ success: false, error: '設定值無效' }, { status: 400 })
  }
  const schedule: PlansSyncSettings = { interval_days: interval, hour }
  await saveEsimSettings(PLANS_SYNC_SETTINGS_KEY, schedule, 'MICROESIM 方案庫自動同步設定')
  return NextResponse.json({ success: true, schedule })
}

/** POST：立即從 MICROESIM.TOP 同步方案庫 */
export async function POST() {
  const authError = await requireAdmin()
  if (authError) return authError
  try {
    const { plans, syncedAt } = await microEsimClient.syncDataplanList()
    const active = plans.filter(p => p.status === '1').length
    return NextResponse.json({ success: true, syncedAt, count: plans.length, active })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 502 })
  }
}
