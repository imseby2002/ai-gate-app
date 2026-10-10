// GET /api/marketing/connector/devices — 列出已配對的桌面連接器
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { data, error } = await (await createClient())
    .from('marketing_connector_devices')
    .select('id, name, last_seen_at, revoked_at, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: `讀取裝置失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ devices: data ?? [] })
}
