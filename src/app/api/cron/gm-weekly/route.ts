import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateGmReport } from '@/lib/gm/report'
import { verifyCronAuth } from '@/lib/cron/auth'

export const maxDuration = 300

// Vercel Cron：每週產生總經理室經營彙整，站內＋Telegram＋Email 推播。
// 收件對象＝有設定 gm 管道（affair_settings.gm_telegram/gm_email）的 owner。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const admin = createAdminClient()
  const { data: settings } = await admin.from('affair_settings').select('owner_id, gm_telegram, gm_email')
  const owners = [...new Set((settings ?? [])
    .filter(s => (s.gm_telegram && String(s.gm_telegram).trim()) || (s.gm_email && String(s.gm_email).trim()))
    .map(s => s.owner_id as string))]

  let done = 0
  const errors: string[] = []
  for (const ownerId of owners) {
    try { await generateGmReport(admin, ownerId, 'weekly'); done++ }
    catch (e) { errors.push(`${ownerId}: ${e instanceof Error ? e.message : e}`) }
  }
  return NextResponse.json({ ok: true, owners: owners.length, done, errors })
}
