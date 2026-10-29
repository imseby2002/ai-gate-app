import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMeetingActor } from '@/lib/meeting/access'

const LANGS = ['zh-TW', 'vi', 'en']

// POST /api/meeting/lines  { meetingId, content, source_lang }
// 訪客的語音辨識結果寫入逐字稿（成員仍由瀏覽器直接寫入 meeting_lines）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const meetingId = String(body?.meetingId ?? '')
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || actor.kind !== 'guest' || !actor.meeting.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const content = String(body?.content ?? '').trim().slice(0, 2000)
  if (!content) return NextResponse.json({ error: 'empty' }, { status: 400 })
  const lang = LANGS.includes(body?.source_lang) ? body.source_lang : 'zh-TW'
  const { data, error } = await createAdminClient().from('meeting_lines').insert({
    meeting_id: meetingId, speaker_id: actor.id, speaker_name: `${actor.name}（訪客）`, content, source_lang: lang,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
