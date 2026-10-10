import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix, requirePlatformAdmin } from '@/lib/social-matrix/access'

const EDITABLE = ['name', 'proxy_type', 'protocol', 'host', 'port', 'username', 'password', 'country', 'city', 'isp',
  'latency_ms', 'monthly_price_twd', 'max_tenants', 'status', 'is_active', 'notes'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const denied = await requirePlatformAdmin(guard.user)
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (k in body) updates[k] = body[k]

  const { data, error } = await createAdminClient()
    .from('marketing_official_proxies')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到此官方 IP' }, { status: 404 })
  return NextResponse.json({ success: true, official_proxy: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const denied = await requirePlatformAdmin(guard.user)
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('marketing_proxy_leases')
    .select('id', { count: 'exact', head: true })
    .eq('official_proxy_id', id)
    .eq('status', 'active')
  if (count) return NextResponse.json({ error: `仍有 ${count} 筆租用中，請先待其到期或改為維護中` }, { status: 409 })

  const { error } = await admin.from('marketing_official_proxies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: `刪除失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, id, message: '已成功自官方租賃庫存下架該 IP' })
}
