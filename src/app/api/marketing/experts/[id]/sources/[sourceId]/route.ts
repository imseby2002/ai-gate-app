/**
 * DELETE /api/marketing/experts/[id]/sources/[sourceId] — 移除知識來源（需 customExpertBuild）
 * RLS 保證只能刪自己的。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const { id, sourceId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '編輯自製專家需 TEAM 以上方案', plan }, { status: 403 })
  }

  const { error } = await supabase
    .from('marketing_expert_sources')
    .delete()
    .eq('id', sourceId)
    .eq('expert_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('marketing_experts')
    .update({ updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
