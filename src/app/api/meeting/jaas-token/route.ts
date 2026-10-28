import { NextRequest, NextResponse } from 'next/server'
import { jaasConfigured, mintJaasToken, getJaasAppId } from '@/lib/meeting/jaas'
import { resolveMeetingActor } from '@/lib/meeting/access'

// 為會議成員或訪客簽發 JaaS 視訊 JWT。
// 未設定 JaaS 時回 501，前端改用內建 WebRTC 視訊。
export async function POST(req: NextRequest) {
  if (!jaasConfigured()) {
    return NextResponse.json({ error: 'JaaS 未設定' }, { status: 501 })
  }

  const { meetingId } = (await req.json().catch(() => ({}))) as { meetingId?: string }
  if (!meetingId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const jwt = mintJaasToken({
    room: actor.meeting.room_code,
    userId: actor.id,
    name: actor.kind === 'guest' ? `${actor.name}（訪客）` : actor.name,
    moderator: actor.isHost,
  })

  return NextResponse.json({ jwt, appId: getJaasAppId(), room: actor.meeting.room_code })
}
