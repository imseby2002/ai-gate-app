import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ghFetch } from '@/lib/feedback/autofix'

// POST - 老闆確認合併：直接呼叫 GitHub 把 AI 產生的 PR squash merge，
// 不用再手動點開 GitHub 網頁操作一次。
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { data: fb } = await admin.from('user_feedback').select('pr_url, status').eq('id', id).single()
  if (!fb) return NextResponse.json({ error: '找不到回饋' }, { status: 404 })
  if (fb.status !== 'pr_ready') return NextResponse.json({ error: '此項目目前沒有待合併的 PR' }, { status: 400 })

  const prNumber = fb.pr_url ? Number(fb.pr_url.match(/\/pull\/(\d+)/)?.[1]) : null
  if (!prNumber) return NextResponse.json({ error: '找不到 PR 編號' }, { status: 400 })

  try {
    await ghFetch(`/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash' }),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const { data, error } = await admin
    .from('user_feedback')
    .update({ status: 'merged', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}
