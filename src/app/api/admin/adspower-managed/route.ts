// GET   /api/admin/adspower-managed — 列出「AI-GATE 代管 AdsPower」申請（含申請者 email）
// PATCH /api/admin/adspower-managed — 開通／更新／拒絕／停用（填入 AdsPower 成員帳號、密碼與專屬分組）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/crypto/secret'
import { defaultManagedGroupName, type ManagedStatus } from '@/lib/connector/managed'

const STATUSES: ManagedStatus[] = ['pending', 'active', 'rejected', 'revoked']

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const guard = await assertAdmin()
  if (guard.res) return guard.res

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketing_adspower_managed')
    .select('user_id, status, contact, note, login_account, login_password_enc, group_name, admin_note, requested_at, activated_at')
    .order('requested_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data ?? []).map(r => r.user_id)
  const { data: profiles } = ids.length
    ? await admin.from('profiles').select('id, email, full_name').in('id', ids)
    : { data: [] }
  const byId = new Map((profiles ?? []).map(p => [p.id, p]))

  return NextResponse.json({
    requests: (data ?? []).map(({ login_password_enc, ...r }) => ({
      ...r,
      has_password: !!login_password_enc,
      default_group_name: defaultManagedGroupName(r.user_id),
      profile: byId.get(r.user_id) ?? null,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const guard = await assertAdmin()
  if (guard.res) return guard.res

  const body = await req.json().catch(() => ({}))
  const userId = String(body.user_id ?? '')
  const status = body.status as ManagedStatus
  if (!userId || !STATUSES.includes(status)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (typeof body.admin_note === 'string') update.admin_note = body.admin_note.trim().slice(0, 1000) || null
  if (typeof body.login_account === 'string') update.login_account = body.login_account.trim().slice(0, 200) || null
  if (typeof body.group_name === 'string') update.group_name = body.group_name.trim().slice(0, 100) || null
  // 密碼留空表示不變更
  if (typeof body.login_password === 'string' && body.login_password) update.login_password_enc = encryptSecret(body.login_password)

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('marketing_adspower_managed')
    .select('login_account, group_name, activated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: '找不到此申請' }, { status: 404 })

  if (status === 'active') {
    const account = (update.login_account ?? current.login_account) as string | null
    if (!account) return NextResponse.json({ error: '開通前請填入 AdsPower 成員登入帳號' }, { status: 400 })
    if (!(update.group_name ?? current.group_name)) update.group_name = defaultManagedGroupName(userId)
    if (!current.activated_at) update.activated_at = new Date().toISOString()
  }

  const { error } = await admin.from('marketing_adspower_managed').update(update).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
