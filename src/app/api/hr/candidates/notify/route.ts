import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyApplicant } from '@/lib/hr/notify'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 人事發送通知給應徵者（Email 或 ZALO）。body: { id, subject, message }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  const subject = String(body.subject ?? '').trim()
  const message = String(body.message ?? '').trim()
  if (!id || !subject || !message) {
    return NextResponse.json({ error: 'id、subject、message 為必填' }, { status: 400 })
  }

  const { data: cand } = await supabase
    .from('agent_hr_candidates')
    .select('email, notify_channel, zalo_user_id, name')
    .eq('id', id).eq('user_id', user.id).single()
  if (!cand) return NextResponse.json({ error: '找不到應徵者' }, { status: 404 })

  const result = await notifyApplicant(user.id, cand, subject, message)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, channel: result.channel })
}
