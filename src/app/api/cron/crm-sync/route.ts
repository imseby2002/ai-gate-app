/**
 * GET /api/cron/crm-sync （Vercel Cron，每天）
 * 把有 RESERVE / BOOKING / 客服資料的帳號依所屬公司分組，同步到各公司的統一客戶系統（CRM）；
 * eSIM 商店訂單同步到平台範圍。
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { companyAccounts, scopeOwnerOf, syncCrmForScope } from '@/lib/crm/sync'

export const maxDuration = 300

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const db = createAdminClient() as SupabaseClient
  const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString()
  const [stores, props, cs, crm] = await Promise.all([
    db.from('reserve_stores').select('user_id').not('user_id', 'is', null).limit(5000),
    db.from('properties').select('user_id').limit(5000),
    db.from('cs_customers').select('user_id').gte('last_message_at', since).limit(5000),
    db.from('crm_contacts').select('owner_id').not('owner_id', 'is', null).gte('updated_at', since).limit(5000),
  ])
  const accounts = new Set<string>([
    ...(stores.data ?? []).map(r => r.user_id as string),
    ...(props.data ?? []).map(r => r.user_id as string),
    ...(cs.data ?? []).map(r => r.user_id as string),
    ...(crm.data ?? []).map(r => r.owner_id as string),
  ])
  const owners = new Set<string>()
  for (const acc of accounts) owners.add(await scopeOwnerOf(db, acc))

  const started = Date.now()
  const results: Record<string, unknown> = {}
  try {
    results.platform = await syncCrmForScope(null, [], { includeEsim: true })
  } catch (err) {
    console.error('[cron-crm-sync] platform', err)
    results.platform = { error: err instanceof Error ? err.message : String(err) }
  }
  for (const ownerId of owners) {
    if (Date.now() - started > 270_000) { results._stopped = 'time budget'; break }
    try {
      results[ownerId] = await syncCrmForScope(ownerId, await companyAccounts(db, ownerId))
    } catch (err) {
      console.error('[cron-crm-sync]', ownerId, err)
      results[ownerId] = { error: err instanceof Error ? err.message : String(err) }
    }
  }
  return NextResponse.json({ ok: true, owners: owners.size, results })
}
