/**
 * PATCH /api/marketing/cs-ai-corrections/[id]  — 撤銷一筆修正（僅限 owner 本人）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isOwner) return NextResponse.json({ error: '只有帳號擁有者可以撤銷修正紀錄' }, { status: 403 })

  const { data, error } = await supabase
    .from('cs_ai_corrections')
    .update({ status: 'reverted', reverted_by: ctx.user.id, reverted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .eq('status', 'active')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ correction: data })
}
