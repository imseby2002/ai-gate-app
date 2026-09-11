import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runFeedbackAutoFix } from '@/lib/feedback/autofix'

export const maxDuration = 300

// POST - 觸發 AI 自動修復（計費項目在核准前會被擋下，見 runFeedbackAutoFix）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { id } = await params

  const { data: fb } = await admin.from('user_feedback').select('user_id').eq('id', id).single()
  if (!fb) return NextResponse.json({ error: '找不到回饋' }, { status: 404 })

  const { data: profile } = await admin.from('profiles').select('user_type').eq('id', user.id).single()
  const isAdmin = profile?.user_type === 'admin'
  if (fb.user_id !== user.id && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runFeedbackAutoFix(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}

// PATCH - 管理者更新狀態/備註/內容，並可核准或拒絕計費項目
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status)                          update.status = body.status
  if (body.admin_notes !== undefined)       update.admin_notes = body.admin_notes
  if (body.title !== undefined)             update.title = body.title
  if (body.description !== undefined)       update.description = body.description
  if (body.price_quote_usd !== undefined)   update.price_quote_usd = body.price_quote_usd

  // 核准計費項目：awaiting_approval → pending，讓它跟免費項目一樣可以送去跑 AI
  if (body.approve === true) update.status = 'pending'

  const { data, error } = await admin.from('user_feedback').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 核准後直接觸發 AI 處理，不用管理者再多按一次「送出處理」
  if (body.approve === true) {
    const result = await runFeedbackAutoFix(id)
    return NextResponse.json({ feedback: data, autofix: result })
  }

  return NextResponse.json({ feedback: data })
}
