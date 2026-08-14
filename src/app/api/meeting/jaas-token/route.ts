import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jaasConfigured, mintJaasToken, getJaasAppId } from '@/lib/meeting/jaas'

// 為目前使用者、指定會議簽發 JaaS 視訊 JWT。
// 會議代碼取自 DB（受 RLS 限制），因此只有該會議的參與者拿得到 token。
export async function POST(req: NextRequest) {
  if (!jaasConfigured()) {
    return NextResponse.json({ error: 'JaaS 未設定' }, { status: 501 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId } = (await req.json()) as { meetingId?: string }
  if (!meetingId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  // RLS：只有參與者/主持人能讀到這場會議
  const { data: meeting } = await supabase
    .from('meetings')
    .select('room_code, host_id')
    .eq('id', meetingId)
    .single()
  if (!meeting) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const jwt = mintJaasToken({
    room: (meeting as { room_code: string }).room_code,
    userId: user.id,
    name: profile?.full_name || user.email || 'guest',
    moderator: (meeting as { host_id: string }).host_id === user.id,
  })

  return NextResponse.json({ jwt, appId: getJaasAppId(), room: (meeting as { room_code: string }).room_code })
}
