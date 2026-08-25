import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDocReminders } from '@/lib/hr/doc-reminders'

// 後台「立即寄缺件提醒」：僅處理自己的人員（沿用週節流，不會重複轟炸）。
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runDocReminders(createAdminClient(), user.id)
  return NextResponse.json({ ok: true, ...result })
}
