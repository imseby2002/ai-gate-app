import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 401 as const, user: null }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { status: 403 as const, user: null }
  return { status: 200 as const, user }
}

export async function GET() {
  const auth = await assertAdmin()
  if (auth.status !== 200) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_notify_settings')
    .select('notify_email, telegram_bot_token, telegram_chat_id, updated_at')
    .eq('id', 1)
    .maybeSingle()

  return NextResponse.json({
    notify_email: data?.notify_email ?? '',
    telegram_bot_token: data?.telegram_bot_token ?? '',
    telegram_chat_id: data?.telegram_chat_id ?? '',
    updated_at: data?.updated_at ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const auth = await assertAdmin()
  if (auth.status !== 200 || !auth.user) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const { notify_email, telegram_bot_token, telegram_chat_id } = await req.json()

  const admin = createAdminClient()
  const { error } = await admin.from('admin_notify_settings').upsert({
    id: 1,
    notify_email: notify_email?.trim() || null,
    telegram_bot_token: telegram_bot_token?.trim() || null,
    telegram_chat_id: telegram_chat_id?.trim() || null,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
