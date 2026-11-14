import { NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { syncCrmForOwner } from '@/lib/crm/sync'

export const maxDuration = 300

// POST /api/crm/sync → 立即從 RESERVE / BOOKING / eSIM / 客服 匯入最新客人資料
export async function POST() {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  try {
    const result = await syncCrmForOwner(auth.user.id, { includeEsim: auth.isAdmin })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[crm-sync]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '同步失敗' }, { status: 500 })
  }
}
