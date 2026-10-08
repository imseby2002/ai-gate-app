import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user || authErr) {
      return NextResponse.json({ error: '請先登入後再加入會議' }, { status: 401 })
    }

    const { code } = await req.json().catch(() => ({}))
    const roomCode = String(code || '').trim().toUpperCase()
    if (!roomCode) {
      return NextResponse.json({ error: '請輸入會議代碼' }, { status: 400 })
    }

    let userName = user.email || 'Member'
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profile?.full_name) userName = profile.full_name
    } catch {}

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : supabase

    // 查詢會議
    const { data: meeting, error: mErr } = await db
      .from('meetings')
      .select('*')
      .eq('room_code', roomCode)
      .eq('is_active', true)
      .maybeSingle()

    if (mErr || !meeting) {
      return NextResponse.json({ error: '找不到會議或會議已結束，請確認代碼' }, { status: 404 })
    }

    // 加入參與者
    try {
      await db.from('meeting_participants').upsert({
        meeting_id: meeting.id,
        user_id: user.id,
        name: userName,
      }, { onConflict: 'meeting_id,user_id' })
    } catch (pErr) {
      console.warn('[api/meeting/join] participant upsert warning:', pErr)
    }

    return NextResponse.json({ meeting })
  } catch (err: unknown) {
    console.error('[api/meeting/join] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '系統伺服器錯誤' }, { status: 500 })
  }
}
