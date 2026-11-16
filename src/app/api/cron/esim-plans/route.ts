/**
 * GET /api/cron/esim-plans（每小時檢查一次）
 * 依後台設定（esim_settings.plans_sync_settings）的頻率與時間，到點才從 MICROESIM.TOP 同步方案庫。
 * 失敗時保留上一次的快取，商城照常運作。
 */
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { getEsimSettings } from '@/lib/esim/db'
import {
  microEsimClient, isPlansSyncDue, PLANS_SYNC_SETTINGS_KEY, DEFAULT_PLANS_SYNC_SETTINGS, PlansSyncSettings,
} from '@/lib/esim/microesim'

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  try {
    const settings = await getEsimSettings<PlansSyncSettings>(PLANS_SYNC_SETTINGS_KEY, DEFAULT_PLANS_SYNC_SETTINGS)
    const { syncedAt: lastSyncedAt } = await microEsimClient.getLastSyncInfo()
    if (!isPlansSyncDue(settings, lastSyncedAt)) {
      return NextResponse.json({ ok: true, skipped: true })
    }
    const { plans, syncedAt } = await microEsimClient.syncDataplanList()
    return NextResponse.json({ ok: true, syncedAt, count: plans.length })
  } catch (err: any) {
    console.error('[cron/esim-plans]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 })
  }
}
