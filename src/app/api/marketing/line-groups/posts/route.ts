/**
 * POST   /api/marketing/line-groups/posts — 建立群組推播
 *   Body: { group_ids: string[], text: string, image_url?: string, scheduled_at?: ISO 字串（未給＝立即發送） }
 * DELETE /api/marketing/line-groups/posts?id=xxx — 取消尚未送出的排程
 * 推播使用客戶自己的 LINE 官方帳號額度（不扣 AI-GATE 點數）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { lineGroupOwnerIds, sendLineGroupPost } from '@/lib/marketing/line-groups'

export const maxDuration = 60
const MAX_GROUPS = 50

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: '文案不可為空' }, { status: 400 })
  const imageUrl = String(body.image_url ?? '').trim()
  if (imageUrl && !/^https:\/\//.test(imageUrl)) return NextResponse.json({ error: '圖片網址需為 https://' }, { status: 400 })

  const ids = Array.isArray(body.group_ids) ? [...new Set(body.group_ids.map(String))].slice(0, MAX_GROUPS) : []
  if (!ids.length) return NextResponse.json({ error: '請選擇至少一個群組' }, { status: 400 })

  let scheduledAt = new Date()
  const sendNow = !body.scheduled_at
  if (!sendNow) {
    scheduledAt = new Date(String(body.scheduled_at))
    if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: '排程時間格式錯誤' }, { status: 400 })
    if (scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: '排程時間不可早於現在' }, { status: 400 })
  }

  const admin = createAdminClient()
  const owners = await lineGroupOwnerIds(guard.user.id)
  const { data: groups } = await admin.from('marketing_line_groups')
    .select('id').in('id', ids).in('user_id', owners).eq('status', 'active')
  const validIds = (groups ?? []).map(g => g.id as string)
  if (!validIds.length) return NextResponse.json({ error: '選擇的群組不存在或官方帳號已離開' }, { status: 400 })

  const { data: post, error } = await admin.from('marketing_line_group_posts')
    .insert({
      user_id: guard.user.id,
      group_ids: validIds,
      text: text.slice(0, 5000),
      image_url: imageUrl || null,
      scheduled_at: scheduledAt.toISOString(),
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: `建立失敗：${error.message}` }, { status: 500 })

  if (sendNow) {
    const sent = await sendLineGroupPost(post.id)
    return NextResponse.json({ success: true, id: post.id, ...sent })
  }
  return NextResponse.json({ success: true, id: post.id, status: 'scheduled' })
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id') ?? ''
  const owners = await lineGroupOwnerIds(guard.user.id)
  const { data } = await createAdminClient().from('marketing_line_group_posts')
    .update({ status: 'canceled' })
    .eq('id', id).in('user_id', owners).eq('status', 'scheduled')
    .select('id')
    .maybeSingle()
  if (!data) return NextResponse.json({ error: '找不到可取消的排程（可能已送出）' }, { status: 404 })
  return NextResponse.json({ success: true })
}
