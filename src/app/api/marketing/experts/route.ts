/**
 * GET  /api/marketing/experts — 列出自己的自製專家（含來源數）
 * POST /api/marketing/experts — 建立自製專家（需 customExpertBuild：TEAM 以上）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('marketing_experts')
    .select('id, name, description, status, created_at, updated_at, marketing_expert_sources(count)')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const experts = (data ?? []).map(e => {
    const { marketing_expert_sources, ...rest } = e as typeof e & { marketing_expert_sources?: { count: number }[] }
    return { ...rest, sourceCount: marketing_expert_sources?.[0]?.count ?? 0 }
  })
  return NextResponse.json({ experts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '建立自製專家需 TEAM 以上方案', plan }, { status: 403 })
  }

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: '請輸入專家名稱' }, { status: 400 })

  const { data, error } = await supabase
    .from('marketing_experts')
    .insert({
      user_id: user.id,
      name,
      description: String(body.description ?? '').trim(),
      system_prompt: String(body.systemPrompt ?? '').trim(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
