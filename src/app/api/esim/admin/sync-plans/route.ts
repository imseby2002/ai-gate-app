import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { microEsimClient } from '@/lib/esim/microesim'

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

/** GET：上次同步時間與方案數 */
export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError
  const info = await microEsimClient.getLastSyncInfo()
  return NextResponse.json({ success: true, ...info })
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
