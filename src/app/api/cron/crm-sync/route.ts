/**
 * GET /api/cron/crm-sync （Vercel Cron，每天）
 * 把所有有 RESERVE / BOOKING / 客服資料的擁有者，重新同步到統一客戶系統（CRM）。
 * eSIM 商店訂單同步給管理員帳號。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { syncCrmForOwner } from '@/lib/crm/sync'

export const maxDuration = 300

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const db = createAdminClient()
  const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString()
  const [stores, props, cs, crm, admins] = await Promise.all([
    db.from('reserve_stores').select('user_id').not('user_id', 'is', null).limit(5000),
    db.from('properties').select('user_id').limit(5000),
    db.from('cs_customers').select('user_id').gte('last_message_at', since).limit(5000),
    db.from('crm_contacts').select('owner_id').gte('updated_at', since).limit(5000),
    db.from('profiles').select('id').eq('user_type', 'admin'),
  ])
  const adminIds = new Set((admins.data ?? []).map(a => a.id as string))
  const owners = new Set<string>([
    ...(stores.data ?? []).map(r => r.user_id as string),
    ...(props.data ?? []).map(r => r.user_id as string),
    ...(cs.data ?? []).map(r => r.user_id as string),
    ...(crm.data ?? []).map(r => r.owner_id as string),
    ...adminIds,
  ])

  const started = Date.now()
  const results: Record<string, unknown> = {}
  for (const ownerId of owners) {
    if (Date.now() - started > 270_000) { results._stopped = 'time budget'; break }
    try {
      results[ownerId] = await syncCrmForOwner(ownerId, { includeEsim: adminIds.has(ownerId) })
    } catch (err) {
      console.error('[cron-crm-sync]', ownerId, err)
      results[ownerId] = { error: err instanceof Error ? err.message : String(err) }
    }
  }
  return NextResponse.json({ ok: true, owners: owners.size, results })
}
