import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, planRequiredResponse } from '@/lib/module-plans/entitlements'
import { minPlanLabel } from '@/lib/module-plans/definitions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('assistants')
    .select('*, assistant_files(id, file_name, file_type, processing_status)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assistants: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, system_prompt, default_model, avatar_emoji, expert_ids } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  // RAG 助理依 AI 對話方案開放與限制數量（內部帳號 getModuleEntitlements 回傳 MAX）
  const ent = await getModuleEntitlements(user.id, 'chat')
  if (!ent.features.ragAssistants) {
    return planRequiredResponse(`RAG 助理需 AI 對話 ${minPlanLabel('chat', f => f.ragAssistants)}方案`, ent.plan)
  }
  if (ent.features.assistantLimit !== Infinity) {
    const { count } = await supabase.from('assistants').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if ((count ?? 0) >= ent.features.assistantLimit) {
      return planRequiredResponse(`已達 RAG 助理數上限 ${ent.features.assistantLimit} 個，MAX 方案不限`, ent.plan)
    }
  }

  const { data, error } = await supabase
    .from('assistants')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() ?? null,
      system_prompt: system_prompt?.trim() ?? '',
      default_model: default_model ?? null,
      avatar_emoji: avatar_emoji ?? '🤖',
      expert_ids: Array.isArray(expert_ids) ? expert_ids : [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assistant: data })
}
