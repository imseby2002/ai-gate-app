import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFeedbackBilling } from '@/lib/feedback/billing'
import { notifyFeedbackAdmin } from '@/lib/feedback/notify'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type').eq('id', user.id).single()
  const isAdmin = profile?.user_type === 'admin'

  let q = admin.from('user_feedback').select('*, profiles(email, full_name), companies(id, name)').order('created_at', { ascending: false })
  if (!isAdmin) q = q.eq('user_id', user.id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedbacks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, type = 'bug', source, contact } = await req.json()
  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: '標題和描述不可為空' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id ?? null
  const { isPaid, initialStatus, quota } = await resolveFeedbackBilling(companyId, type)

  const { data, error } = await admin
    .from('user_feedback')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      type,
      contact: contact?.trim() || null,
      company_id: companyId,
      is_paid: isPaid,
      status: initialStatus,
      // 前端沒帶（例如舊版 APP）就標記不明來源，而不是靜默留空
      source: typeof source === 'string' && source.trim() ? source.trim() : 'unknown',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (isPaid) {
    await notifyFeedbackAdmin(
      `[意見反映] 新的計費需求待審核：${data.title}`,
      [
        `類型：${type}`, `帳號：${user.email ?? user.id}`, `內容：${description}`,
        ...(quota ? [`本月免費額度已用完：${quota.used}/${quota.limit}`] : []),
        `後台審核：https://www.im-tourist.com/admin/feedback`,
      ]
    )
  }

  return NextResponse.json({ feedback: data })
}
