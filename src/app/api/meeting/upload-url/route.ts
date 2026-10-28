import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMeetingActor } from '@/lib/meeting/access'

const MAX = 50 * 1024 * 1024

// POST /api/meeting/upload-url  { meetingId, name, size }  取得直接上傳到 Storage 的簽章網址
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const meetingId = String(body?.meetingId ?? '')
  const actor = await resolveMeetingActor(req, meetingId)
  if (!actor || !actor.meeting.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const size = Number(body?.size) || 0
  if (size <= 0 || size > MAX) return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  const name = String(body?.name ?? 'file')
  const ext = (name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? 'bin').toLowerCase()
  const path = `${meetingId}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await createAdminClient().storage.from('meeting-files').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'failed' }, { status: 500 })
  return NextResponse.json({ path: data.path, token: data.token })
}
