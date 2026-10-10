// PATCH /api/connector/profiles/[id] — 連接器回寫 AdsPower 設定檔 ID（綁定到這台裝置）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireConnectorDevice } from '@/lib/connector/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConnectorDevice(req)
  if (guard.res) return guard.res

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const profileId = body.adspower_profile_id === null ? null : String(body.adspower_profile_id ?? '').trim()
  if (profileId === '') return NextResponse.json({ error: '缺少 adspower_profile_id' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('marketing_social_accounts')
    .update({
      adspower_profile_id: profileId,
      connector_device_id: profileId ? guard.device.deviceId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', guard.device.userId)
    .or(`connector_device_id.is.null,connector_device_id.eq.${guard.device.deviceId}`)
    .select('id, adspower_profile_id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到此帳號，或已綁定其他裝置' }, { status: 404 })
  return NextResponse.json({ success: true, profile: data })
}
