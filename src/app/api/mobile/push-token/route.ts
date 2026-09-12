import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUserMobile } from '@/lib/push/expo'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { push_token, device_os, device_name, test = false } = body

  if (!push_token || typeof push_token !== 'string') {
    return NextResponse.json({ error: '無效的 push_token' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. 更新 profiles
  await admin.from('profiles').update({
    push_token,
    push_token_updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  // 2. 寫入 user_push_tokens (upsert)
  try {
    await admin.from('user_push_tokens').upsert(
      {
        user_id: user.id,
        push_token,
        device_os: device_os || null,
        device_name: device_name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,push_token' }
    )
  } catch {
    // 忽略未 migration 錯誤
  }

  // 若請求測試推播，立即發送一則推播至該手機
  if (test) {
    const pushResult = await notifyUserMobile(user.id, {
      title: '🎉 AI GATE 行動推播已連通！',
      body: '這是一則測試通知，代表您的手機已成功與系統推播通道完成綁定。',
      data: { type: 'test' },
    })
    return NextResponse.json({ success: true, pushResult })
  }

  return NextResponse.json({ success: true })
}
