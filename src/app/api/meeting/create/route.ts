import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user || authErr) {
      return NextResponse.json({ error: '請先登入後再建立會議' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const {
      title,
      source_lang = 'zh-TW',
      department = '',
      departments = [],
      meeting_mode = 'in_person',
      stores = [],
      context_keywords = '',
    } = body

    // 會議語言：主要語言 + 其他會出現的語言（僅限中/越/英，且不含主要語言）
    const LANGS = ['zh-TW', 'vi', 'en']
    const primaryLang = LANGS.includes(source_lang) ? source_lang : 'zh-TW'
    const otherLangs = Array.isArray(body.other_langs)
      ? LANGS.filter(l => l !== primaryLang && (body.other_langs as unknown[]).includes(l))
      : []

    // 取得使用者姓名
    let userName = user.email || 'Host'
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profile?.full_name) userName = profile.full_name
    } catch {}

    // 優先使用 admin client 寫入（繞過 RLS RETURNING 與 profiles 外鍵限制），無 service key 則用使用者 client
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : supabase

    // 確保 profiles 存在對應用戶（避免 host_id 外鍵約束失敗）
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await db.from('profiles').upsert(
          { id: user.id, email: user.email, full_name: userName },
          { onConflict: 'id' }
        )
      } catch {}
    }

    // 產生 6 位隨機會議代碼
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let roomCode = ''
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // 嘗試以完整欄位寫入
    let createdMeeting: Record<string, unknown> | null = null
    const v2Payload = {
      host_id: user.id,
      title: title || '會議',
      room_code: roomCode,
      source_lang: primaryLang,
      other_langs: otherLangs,
      department,
      departments,
      meeting_mode,
      stores,
      context_keywords,
      is_active: true,
    }

    const { data, error } = await db.from('meetings').insert(v2Payload).select('*').single()
    if (!error && data) {
      createdMeeting = data
    } else {
      console.warn('[api/meeting/create] v2 insert failed, trying basic fields:', error?.message)
      // 若資料表尚未執行 20261008 migration，退回基礎欄位建立
      const basicPayload = {
        host_id: user.id,
        title: title || '會議',
        room_code: roomCode,
        source_lang: primaryLang,
        is_active: true,
      }
      const fb = await db.from('meetings').insert(basicPayload).select('*').single()
      if (!fb.error && fb.data) {
        createdMeeting = fb.data
      } else {
        console.error('[api/meeting/create] Both inserts failed:', fb.error)
        const errMsg = fb.error?.message || error?.message || '建立會議失敗'
        if (errMsg.includes('relation "public.meetings" does not exist') || errMsg.includes('meetings')) {
          return NextResponse.json({
            error: '資料庫尚未建立 meetings 資料表。請在 Supabase SQL 編輯器執行 migration 098_meetings.sql。',
            detail: errMsg,
          }, { status: 500 })
        }
        return NextResponse.json({ error: errMsg }, { status: 500 })
      }
    }

    // 將主持人自動加入參與者
    if (createdMeeting?.id) {
      try {
        await db.from('meeting_participants').insert({
          meeting_id: createdMeeting.id,
          user_id: user.id,
          name: userName,
        })
      } catch (pErr) {
        console.warn('[api/meeting/create] participant insert warning:', pErr)
      }
    }

    return NextResponse.json({ meeting: createdMeeting })
  } catch (err: unknown) {
    console.error('[api/meeting/create] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '系統伺服器錯誤' }, { status: 500 })
  }
}
