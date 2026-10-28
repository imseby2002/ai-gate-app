import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMeetingActor } from '@/lib/meeting/access'

// GET /api/meeting/guests?meetingId=…  訪客設定與名單（成員可看）
export async function GET(req: NextRequest) {
  const meetingId = req.nextUrl.searchParams.get('meetingId') ?? ''
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || actor.kind !== 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: guests } = await createAdminClient().from('meeting_guests')
    .select('id, name, created_at').eq('meeting_id', meetingId).order('created_at')
  return NextResponse.json({ allow_guests: actor.meeting.allow_guests, isHost: actor.isHost, guests: guests ?? [] })
}

// POST /api/meeting/guests  { meetingId, allow }  主持人開關「允許訪客加入」
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const meetingId = String(body?.meetingId ?? '')
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || !actor.isHost) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const allow = !!body?.allow
  const { error } = await createAdminClient().from('meetings').update({ allow_guests: allow }).eq('id', meetingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, allow_guests: allow })
}
