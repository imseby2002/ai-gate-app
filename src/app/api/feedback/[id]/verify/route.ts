import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyFeedbackCompletion } from '@/lib/feedback/verify'

export const maxDuration = 120

// POST - 請 AI 驗收：判斷提案是否已由已合併的程式修改完成（僅平台管理員）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await createAdminClient().from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const result = await verifyFeedbackCompletion(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
