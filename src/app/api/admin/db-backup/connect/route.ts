import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getBackupOAuthUrl } from '@/lib/backup/db-backup'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const nonce = randomBytes(16).toString('hex')
  try {
    const url = getBackupOAuthUrl(`${appUrl}/api/admin/db-backup/callback`, nonce)
    const res = NextResponse.redirect(url)
    res.cookies.set('db_backup_oauth', nonce, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/admin/db-backup' })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.redirect(`${appUrl}/admin/db-backup?error=${encodeURIComponent(msg)}`)
  }
}
