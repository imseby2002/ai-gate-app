import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

const EDITABLE = ['name', 'proxy_type', 'protocol', 'host', 'port', 'username', 'password', 'country', 'city', 'isp', 'notes'] as const

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const supabase = await createClient()
  const { data: proxy } = await supabase.from('marketing_proxies').select('lease_id').eq('id', id).maybeSingle()
  if (!proxy) return NextResponse.json({ error: '找不到此代理' }, { status: 404 })
  if (proxy.lease_id) return NextResponse.json({ error: '官方租用的 IP 請改用「退租」移除' }, { status: 409 })

  await supabase.from('marketing_social_accounts').update({ proxy_id: null }).eq('proxy_id', id)
  const { error } = await supabase.from('marketing_proxies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: `刪除失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, id })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (k in body) updates[k] = k === 'port' ? Number(body[k]) : body[k]

  const supabase = await createClient()
  const { data, error } = await supabase.from('marketing_proxies').update(updates).eq('id', id).select().maybeSingle()
  if (error) return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到此代理' }, { status: 404 })
  return NextResponse.json({ success: true, proxy: data })
}
