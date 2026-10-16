// POST /api/connector/tasks/claim — 連接器輪詢領取待辦任務（附帶帳號／代理資料）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireConnectorDevice } from '@/lib/connector/auth'

export async function POST(req: NextRequest) {
  const guard = await requireConnectorDevice(req)
  if (guard.res) return guard.res

  const admin = createAdminClient()
  const { data: tasks, error } = await admin.rpc('claim_connector_tasks', {
    p_user_id: guard.device.userId,
    p_device_id: guard.device.deviceId,
    p_limit: 5,
  })
  if (error) return NextResponse.json({ error: `領取任務失敗：${error.message}` }, { status: 500 })

  const list = (tasks ?? []) as { account_id: string | null }[]
  const accountIds = [...new Set(list.map(t => t.account_id).filter(Boolean))] as string[]
  const { data: accounts } = accountIds.length
    ? await admin
        .from('marketing_social_accounts')
        .select('id, platform, account_name, adspower_profile_id')
        .in('id', accountIds)
        .eq('user_id', guard.device.userId)
    : { data: [] }
  const byId = new Map((accounts ?? []).map(a => [a.id, a]))
  return NextResponse.json({ tasks: list.map(t => ({ ...t, account: t.account_id ? byId.get(t.account_id) ?? null : null })) })
}
