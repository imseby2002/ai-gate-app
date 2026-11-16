/**
 * GET /api/cron/esim-plans（每 6 小時）
 * 從 MICROESIM.TOP 同步方案庫並寫入 esim_settings.plans_cache。
 * 失敗時保留上一次的快取，商城照常運作。
 */
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { microEsimClient } from '@/lib/esim/microesim'

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  try {
    const { plans, syncedAt } = await microEsimClient.syncDataplanList()
    return NextResponse.json({ ok: true, syncedAt, count: plans.length })
  } catch (err: any) {
    console.error('[cron/esim-plans]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 })
  }
}
