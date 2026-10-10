// DELETE /api/marketing/connector/devices/[id] — 撤銷裝置（token 立即失效）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketing_connector_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', guard.user.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: `撤銷失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到此裝置' }, { status: 404 })
  await admin.from('marketing_connector_tasks').update({ status: 'canceled', finished_at: new Date().toISOString() })
    .eq('device_id', id).in('status', ['pending', 'claimed'])
  return NextResponse.json({ success: true, id })
}
