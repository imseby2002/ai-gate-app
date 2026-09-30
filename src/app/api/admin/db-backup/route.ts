import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BACKUP_SETTINGS_ID, getCompanyBackupTargets, runDbBackup } from '@/lib/backup/db-backup'

export const maxDuration = 300

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 401
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  return profile?.user_type === 'admin' ? 200 : 403
}

export async function GET() {
  const status = await assertAdmin()
  if (status !== 200) return NextResponse.json({ error: 'Forbidden' }, { status })

  const admin = createAdminClient()
  const { data } = await admin
    .from('system_backup_settings')
    .select('email, refresh_token, folder_id, last_run_at, last_status, last_file')
    .eq('id', BACKUP_SETTINGS_ID)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data?.refresh_token,
    email: data?.email ?? '',
    folder_id: data?.folder_id ?? '',
    last_run_at: data?.last_run_at ?? null,
    last_status: data?.last_status ?? '',
    last_file: data?.last_file ?? '',
    companies: await getCompanyBackupTargets(),
  })
}

// 開關某公司的自動備份（非企業版／MAX 為付費加購）
export async function PUT(req: NextRequest) {
  const status = await assertAdmin()
  if (status !== 200) return NextResponse.json({ error: 'Forbidden' }, { status })
  const { company_id, enabled } = await req.json()
  if (!company_id) return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from('company_backup_settings').upsert({
    company_id, enabled: !!enabled, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 立即備份
export async function POST() {
  const status = await assertAdmin()
  if (status !== 200) return NextResponse.json({ error: 'Forbidden' }, { status })
  const result = await runDbBackup()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
