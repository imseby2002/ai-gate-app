import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMeetingActor } from '@/lib/meeting/access'

// POST /api/meeting/video-mode  { meetingId, mode: 'auto' | 'webrtc' }
// 這場會議改用內建視訊（JaaS 不穩時的備案）或改回自動；成員與訪客皆可切換（瀏覽者不行）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const meetingId = String(body?.meetingId ?? '')
  const mode = body?.mode === 'webrtc' ? 'webrtc' : 'auto'
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || actor.viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await createAdminClient().from('meetings').update({ video_mode: mode }).eq('id', meetingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode })
}
