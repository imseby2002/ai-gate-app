import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resumeRunAfterApproval } from '@/lib/agents/approvals'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, feedback } = await req.json()
  if (!['approve', 'reject', 'feedback'].includes(action)) {
    return NextResponse.json({ error: 'action 必須是 approve/reject/feedback' }, { status: 400 })
  }

  const { data: approval } = await supabase
    .from('agent_approvals')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!approval || approval.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!['pending', 'awaiting_feedback'].includes(approval.status)) {
    return NextResponse.json({ error: '此核准請求已處理過' }, { status: 409 })
  }

  const outcome = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'feedback'
  const result = await resumeRunAfterApproval(id, outcome, feedback)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
