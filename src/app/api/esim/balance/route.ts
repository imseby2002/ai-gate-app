import { NextRequest, NextResponse } from 'next/server'
import { microEsimClient } from '@/lib/esim/microesim'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return null
  return supabase
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  try {
    const [balanceInfo, notices] = await Promise.all([
      microEsimClient.getAccountBalance().catch(e => ({ balance: 0, currency: 'HKD', account: 'imseby', error: e.message })),
      microEsimClient.getDailyNotices().catch(() => []),
    ])

    return NextResponse.json({
      success: true,
      balance: balanceInfo,
      notices,
      checkedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '無法取得 MicroEsim 狀態' },
      { status: 500 }
    )
  }
}
