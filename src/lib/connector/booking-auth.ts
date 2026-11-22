// 訂房讀後台連接器（瀏覽器外掛）驗證：沿用桌面連接器的裝置 token 機制，但不綁行銷社群矩陣權限。
// 外掛以配對碼換取裝置 token（/api/connector/pair），之後以 Bearer token 呼叫 /api/connector/booking/*。
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from '@/lib/connector/auth'

export interface BookingDevice {
  deviceId: string
  userId: string
}

/** 驗證連接器 Bearer token，取得裝置所屬的民宿擁有者 id。不檢查行銷方案權限。 */
export async function requireBookingDevice(
  req: NextRequest,
): Promise<{ device: BookingDevice; res?: never } | { device?: never; res: NextResponse }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { res: NextResponse.json({ error: '缺少裝置 token' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: dev } = await admin
    .from('marketing_connector_devices')
    .select('id, user_id, revoked_at')
    .eq('token_hash', sha256(token))
    .maybeSingle()
  if (!dev || dev.revoked_at) {
    return { res: NextResponse.json({ error: '裝置未配對或已撤銷，請重新配對' }, { status: 401 }) }
  }

  await admin.from('marketing_connector_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', dev.id)
  return { device: { deviceId: dev.id, userId: dev.user_id } }
}
