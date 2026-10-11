// GET /api/connector/profiles — 連接器取得要同步到 AdsPower 的社群帳號與綁定代理（含代理帳密），以及代管方案指定的分組
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireConnectorDevice } from '@/lib/connector/auth'
import { getConnectorSettings } from '@/lib/connector/managed'

export async function GET(req: NextRequest) {
  const guard = await requireConnectorDevice(req)
  if (guard.res) return guard.res

  const { data, error } = await createAdminClient()
    .from('marketing_social_accounts')
    .select('id, platform, account_name, account_handle, status, adspower_profile_id, connector_device_id, proxy:marketing_proxies(id, protocol, host, port, username, password, country)')
    .eq('user_id', guard.device.userId)
    .neq('status', 'banned')
    .order('created_at')
  if (error) return NextResponse.json({ error: `讀取帳號失敗：${error.message}` }, { status: 500 })

  // 已綁定到其他裝置的帳號不交給這台
  const profiles = (data ?? []).filter(a => !a.connector_device_id || a.connector_device_id === guard.device.deviceId)
  const settings = await getConnectorSettings(guard.device.userId)
  return NextResponse.json({ device_id: guard.device.deviceId, profiles, settings })
}
