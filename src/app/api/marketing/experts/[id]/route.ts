/**
 * GET    /api/marketing/experts/[id] — 取得單一專家與其知識來源
 * PATCH  /api/marketing/experts/[id] — 更新名稱／描述／system_prompt（需 customExpertBuild）
 * DELETE /api/marketing/experts/[id] — 封存專家（需 customExpertBuild）
 * RLS 保證只能存取自己的資料。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: expert, error } = await supabase
    .from('marketing_experts')
    .select('id, name, description, system_prompt, status, created_at, updated_at')
    .eq('id', id)
    .single()
  if (error || !expert) return NextResponse.json({ error: '找不到專家' }, { status: 404 })

  const { data: sources } = await supabase
    .from('marketing_expert_sources')
    .select('id, type, name, source_url, char_count, created_at')
    .eq('expert_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ expert, sources: sources ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '編輯自製專家需 TEAM 以上方案', plan }, { status: 403 })
  }

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') patch.name = body.name.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim()
  if (typeof body.systemPrompt === 'string') patch.system_prompt = body.systemPrompt.trim()

  const { error } = await supabase.from('marketing_experts').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '刪除自製專家需 TEAM 以上方案', plan }, { status: 403 })
  }

  const { error } = await supabase
    .from('marketing_experts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
