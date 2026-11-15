import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { companyAccounts, syncCrmForScope } from '@/lib/crm/sync'

export const maxDuration = 300

// POST /api/crm/sync → 立即把公司所有成員帳號的 RESERVE / BOOKING / 客服客人匯入公司客戶系統；
// 總管理員帶 ?scope=platform 時同步平台範圍（eSIM 商店客人）
export async function POST(req: NextRequest) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  try {
    const result = auth.ownerId
      ? await syncCrmForScope(auth.ownerId, await companyAccounts(auth.supabase, auth.ownerId))
      : await syncCrmForScope(null, [], { includeEsim: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[crm-sync]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '同步失敗' }, { status: 500 })
  }
}
