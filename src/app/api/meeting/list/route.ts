import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/meeting/list  我看得到的會議（主持、參加、被授權、公司管理者）＋主持人姓名與我的角色
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: meetings, error } = await supabase.from('meetings')
    .select('id, title, room_code, host_id, source_lang, other_langs, department, departments, meeting_mode, stores, context_keywords, created_at, is_active')
    .order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const list = meetings ?? []
  const admin = createAdminClient()
  const hostIds = Array.from(new Set(list.map(m => m.host_id)))
  const [{ data: profs }, { data: parts }] = await Promise.all([
    hostIds.length ? admin.from('profiles').select('id, full_name, email').in('id', hostIds) : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
    list.length ? admin.from('meeting_participants').select('meeting_id').eq('user_id', user.id).in('meeting_id', list.map(m => m.id)) : Promise.resolve({ data: [] as { meeting_id: string }[] }),
  ])
  const nameOf = new Map((profs ?? []).map(p => [p.id, p.full_name || p.email || '']))
  const joined = new Set((parts ?? []).map(p => p.meeting_id))
  return NextResponse.json({
    meetings: list.map(m => ({
      ...m, host_name: nameOf.get(m.host_id) ?? '',
      role: m.host_id === user.id ? 'host' : joined.has(m.id) ? 'participant' : 'viewer',
    })),
  })
}
