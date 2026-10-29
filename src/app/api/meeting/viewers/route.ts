import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 會議紀錄瀏覽授權：主持人授權同事瀏覽「自己主持的所有會議」
async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function companyOf(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from('company_members').select('company_id').eq('member_id', userId).eq('status', 'active')
  return (data ?? []).map(r => r.company_id as string)
}

// GET：我授權的人、授權給我的人、可選的同公司成員
export async function GET() {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const companies = await companyOf(admin, user.id)
  const [{ data: mine }, { data: toMe }, { data: members }] = await Promise.all([
    admin.from('meeting_viewer_grants').select('id, viewer_id, created_at').eq('host_id', user.id),
    admin.from('meeting_viewer_grants').select('id, host_id, created_at').eq('viewer_id', user.id),
    companies.length
      ? admin.from('company_members').select('member_id, role').in('company_id', companies).eq('status', 'active')
      : Promise.resolve({ data: [] as { member_id: string; role: string }[] }),
  ])
  const ids = Array.from(new Set([...(members ?? []).map(m => m.member_id), ...(mine ?? []).map(g => g.viewer_id), ...(toMe ?? []).map(g => g.host_id)]))
  const { data: profs } = ids.length ? await admin.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] }
  const nameOf = new Map((profs ?? []).map(p => [p.id, p.full_name || p.email || '']))
  return NextResponse.json({
    granted: (mine ?? []).map(g => ({ id: g.id, user_id: g.viewer_id, name: nameOf.get(g.viewer_id) ?? '', created_at: g.created_at })),
    grantedToMe: (toMe ?? []).map(g => ({ id: g.id, user_id: g.host_id, name: nameOf.get(g.host_id) ?? '', created_at: g.created_at })),
    candidates: (members ?? []).filter(m => m.member_id !== user.id)
      .map(m => ({ user_id: m.member_id, name: nameOf.get(m.member_id) ?? '', role: m.role }))
      .filter((m, i, a) => a.findIndex(x => x.user_id === m.user_id) === i)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })
}

// POST { viewerId }：授權同公司成員瀏覽我主持的會議
export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { viewerId } = await req.json().catch(() => ({}))
  if (!viewerId || viewerId === user.id) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  const companies = await companyOf(admin, user.id)
  const { data: same } = companies.length
    ? await admin.from('company_members').select('member_id').in('company_id', companies).eq('member_id', viewerId).eq('status', 'active').limit(1)
    : { data: [] }
  if (!same?.length) return NextResponse.json({ error: '只能授權同公司成員' }, { status: 403 })
  const { error } = await admin.from('meeting_viewer_grants')
    .upsert({ host_id: user.id, viewer_id: viewerId, granted_by: user.id }, { onConflict: 'host_id,viewer_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE { id }：取消我給出的授權
export async function DELETE(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { error } = await createAdminClient().from('meeting_viewer_grants').delete().eq('id', id).eq('host_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
