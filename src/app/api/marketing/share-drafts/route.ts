/**
 * POST /api/marketing/share-drafts — 建立個人 LINE／Zalo 群組一鍵帶入草稿
 *   Body: { app: 'line' | 'zalo', group_name?: string, text: string, notify?: boolean }
 *   notify=true 時以官方帳號通知持有人（客服「專員綁定」名單）
 * 回傳：{ id, url, line_url?, notified }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { lineShareUrl, notifyHolders, shareDraftUrl, type ShareApp } from '@/lib/marketing/share-drafts'

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const app: ShareApp | null = body.app === 'line' || body.app === 'zalo' ? body.app : null
  if (!app) return NextResponse.json({ error: '請選擇 LINE 或 Zalo' }, { status: 400 })
  const text = String(body.text ?? '').trim().slice(0, 4000)
  if (!text) return NextResponse.json({ error: '文案不可為空' }, { status: 400 })
  const groupName = String(body.group_name ?? '').trim().slice(0, 100) || null

  const admin = createAdminClient()
  const { data: draft, error } = await admin.from('marketing_share_drafts')
    .insert({ user_id: guard.user.id, app, group_name: groupName, text })
    .select('id, app, group_name, text')
    .single()
  if (error) return NextResponse.json({ error: `建立失敗：${error.message}` }, { status: 500 })

  let notified = 0
  if (body.notify === true) {
    notified = await notifyHolders(guard.user.id, draft)
    await admin.from('marketing_share_drafts').update({ notified_count: notified }).eq('id', draft.id)
  }
  return NextResponse.json({
    id: draft.id,
    url: shareDraftUrl(draft.id),
    ...(app === 'line' ? { line_url: lineShareUrl(text) } : {}),
    notified,
  })
}
