import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCode, getDriveUserEmail } from '@/lib/google-drive'
import { BACKUP_SETTINGS_ID } from '@/lib/backup/db-backup'

export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.origin
  const back = (q: string) => NextResponse.redirect(`${appUrl}/admin/db-backup?${q}`)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (searchParams.get('error') || !code || !state) return back('error=' + encodeURIComponent('Google 授權取消或失敗'))
  if (state !== req.cookies.get('db_backup_oauth')?.value) return back('error=' + encodeURIComponent('授權驗證失敗，請重試'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return back('error=' + encodeURIComponent('請先登入'))
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return back('error=' + encodeURIComponent('僅管理者可設定'))

  const tokens = await exchangeCode(code, `${appUrl}/api/admin/db-backup/callback`)
  if (tokens.error || !tokens.access_token || !tokens.refresh_token) {
    return back('error=' + encodeURIComponent(`取得授權失敗：${tokens.error ?? '未取得 refresh token'}`))
  }
  const email = await getDriveUserEmail(tokens.access_token)

  const admin = createAdminClient()
  const { error } = await admin.from('system_backup_settings').upsert({
    id: BACKUP_SETTINGS_ID,
    email,
    refresh_token: tokens.refresh_token,
    folder_id: '',
    updated_at: new Date().toISOString(),
  })
  if (error) return back('error=' + encodeURIComponent(error.message))

  const res = back('connected=1')
  res.cookies.delete({ name: 'db_backup_oauth', path: '/api/admin/db-backup' })
  return res
}
