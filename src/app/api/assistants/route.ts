import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
