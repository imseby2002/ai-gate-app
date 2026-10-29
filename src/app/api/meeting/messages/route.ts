import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMeetingActor } from '@/lib/meeting/access'

type Msg = { id: string; sender_kind: string; sender_id: string; sender_name: string; body: string; file_path: string | null; file_name: string | null; file_type: string | null; file_size: number | null; created_at: string }

// GET /api/meeting/messages?meetingId=…&after=ISO  聊天訊息（檔案附簽章下載網址）
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const meetingId = sp.get('meetingId') ?? ''
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  let q = admin.from('meeting_messages')
    .select('id, sender_kind, sender_id, sender_name, body, file_path, file_name, file_type, file_size, created_at')
    .eq('meeting_id', meetingId).order('created_at').limit(500)
  const after = sp.get('after')
  if (after) q = q.gt('created_at', after)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Msg[]
  const paths = rows.map(r => r.file_path).filter(Boolean) as string[]
  const urls: Record<string, string> = {}
  if (paths.length) {
    const { data: signed } = await admin.storage.from('meeting-files').createSignedUrls(paths, 60 * 60 * 6)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
  }
  return NextResponse.json({
    me: { kind: actor.kind, id: actor.id },
    messages: rows.map(r => ({ ...r, file_url: r.file_path ? urls[r.file_path] ?? null : null })),
  })
}

// POST /api/meeting/messages  { meetingId, body?, file?: { path, name, type, size } }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const meetingId = String(b?.meetingId ?? '')
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || actor.viewer || !actor.meeting.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const text = String(b?.body ?? '').trim().slice(0, 4000)
  const f = b?.file && typeof b.file === 'object' ? b.file : null
  const filePath = f ? String(f.path ?? '') : ''
  if (filePath && !filePath.startsWith(`${meetingId}/`)) return NextResponse.json({ error: 'bad_file' }, { status: 400 })
  if (!text && !filePath) return NextResponse.json({ error: 'empty' }, { status: 400 })
  const { data, error } = await createAdminClient().from('meeting_messages').insert({
    meeting_id: meetingId, sender_kind: actor.kind, sender_id: actor.id, sender_name: actor.name, body: text,
    file_path: filePath || null, file_name: f ? String(f.name ?? '').slice(0, 200) : null,
    file_type: f ? String(f.type ?? '').slice(0, 100) : null, file_size: f ? Number(f.size) || null : null,
  }).select('id, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: data })
}
