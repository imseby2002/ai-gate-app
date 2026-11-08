/**
 * GET /api/marketing/line-groups — LINE 官方帳號所在的群組＋最近 30 筆群組推播
 * 群組由客服 webhook 記錄（官方帳號被邀進群組或在群組收到訊息時）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { lineGroupOwnerIds } from '@/lib/marketing/line-groups'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const owners = await lineGroupOwnerIds(guard.user.id)
  const [{ data: groups }, { data: posts }] = await Promise.all([
    admin.from('marketing_line_groups')
      .select('id, name, picture_url, status, joined_at, last_seen_at')
      .in('user_id', owners)
      .order('status').order('last_seen_at', { ascending: false }),
    admin.from('marketing_line_group_posts')
      .select('id, group_ids, text, image_url, scheduled_at, status, results, sent_at, created_at')
      .in('user_id', owners)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  return NextResponse.json({ groups: groups ?? [], posts: posts ?? [] })
}
