import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  return profile?.user_type === 'admin' ? user : null
}

export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { modelId, ...updates } = await req.json()
  if (!modelId) return NextResponse.json({ error: 'modelId required' }, { status: 400 })

  const allowedFields = ['is_enabled', 'input_cost_per_1k', 'output_cost_per_1k', 'image_cost_per_unit', 'video_cost_per_sec']
  const safeUpdates = Object.fromEntries(Object.entries(updates).filter(([k]) => allowedFields.includes(k)))

  const supabase = await createAdminClient()
  const { error } = await supabase.from('ai_models').update(safeUpdates).eq('id', modelId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
