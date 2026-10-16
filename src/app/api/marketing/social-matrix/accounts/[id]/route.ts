import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

const EDITABLE = ['account_name', 'account_handle', 'avatar_url', 'proxy_id', 'status', 'max_daily_actions', 'target_niches'] as const

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('marketing_social_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: `刪除失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, id })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of EDITABLE) if (k in body) updates[k] = body[k]

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_social_accounts')
    .update(updates)
    .eq('id', id)
    .select('*, proxy:marketing_proxies(*)')
    .maybeSingle()
  if (error) return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ error: '找不到此帳號' }, { status: 404 })
  return NextResponse.json({ success: true, account: data })
}
