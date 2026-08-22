import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAffairReminders } from '@/lib/affairs/reminders'

// 後台「立即檢查提醒」：僅處理自己的文件（沿用去重，不會重複發送）。
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runAffairReminders(createAdminClient(), user.id)
  return NextResponse.json({ ok: true, ...result })
}
