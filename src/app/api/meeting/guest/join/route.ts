import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signGuestToken } from '@/lib/meeting/access'

// POST /api/meeting/guest/join  訪客（免登入）以會議代碼＋姓名加入
// body: { code, name }；主持人須先開啟「允許訪客」
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body?.code ?? '').trim().toUpperCase()
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: meeting } = await admin.from('meetings')
    .select('id, title, room_code, is_active, allow_guests, source_lang, other_langs').eq('room_code', code).eq('is_active', true).maybeSingle()
  if (!meeting) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!meeting.allow_guests) return NextResponse.json({ error: 'guests_closed' }, { status: 403 })

  const { data: guest, error } = await admin.from('meeting_guests').insert({ meeting_id: meeting.id, name }).select('id').single()
  if (error || !guest) return NextResponse.json({ error: error?.message ?? 'failed' }, { status: 500 })

  return NextResponse.json({
    token: signGuestToken({ m: meeting.id, g: guest.id, n: name }),
    guest: { id: guest.id, name },
    meeting: { id: meeting.id, title: meeting.title, room_code: meeting.room_code, source_lang: meeting.source_lang, other_langs: meeting.other_langs ?? [] },
  })
}
