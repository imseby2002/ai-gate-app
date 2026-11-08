/**
 * POST /api/marketing/share-drafts — 建立個人 LINE／Zalo 群組一鍵帶入草稿
 *   Body: { app: 'line' | 'zalo', group_name?: string, text: string, notify?: boolean }
 *   holder_id：以該持有人的 Telegram 通知（本人或同公司成員、個人設定已填 Telegram）
 *   notify=true 且未指定 holder_id：以 LINE 官方帳號通知「專員綁定」名單
 * 回傳：{ id, url, line_url?, notified, channel }
 * GET  /api/marketing/share-drafts — 可用 Telegram 通知的持有人
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { lineShareUrl, notifyHolders, notifyHolderTelegram, shareDraftUrl, telegramHolders, type ShareApp } from '@/lib/marketing/share-drafts'

export async function POST(req: NextRequest) {
  // 社群矩陣與客服頁共用：登入即可（不限方案）
  const user = await getCronOrUserAuth(req)
  if (!user || user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = { user }

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
  let channel: 'telegram' | 'line_oa' | null = null
  const holderId = String(body.holder_id ?? '')
  if (holderId) {
    channel = 'telegram'
    notified = (await notifyHolderTelegram(guard.user.id, holderId, draft)) ? 1 : 0
  } else if (body.notify === true) {
    channel = 'line_oa'
    notified = await notifyHolders(guard.user.id, draft)
  }
  if (channel) await admin.from('marketing_share_drafts').update({ notified_count: notified }).eq('id', draft.id)
  return NextResponse.json({
    id: draft.id,
    url: shareDraftUrl(draft.id),
    ...(app === 'line' ? { line_url: lineShareUrl(text) } : {}),
    notified,
    channel,
  })
}

export async function GET(req: NextRequest) {
  // 社群矩陣與客服頁共用：登入即可（不限方案）
  const user = await getCronOrUserAuth(req)
  if (!user || user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = { user }
  return NextResponse.json({ holders: await telegramHolders(guard.user.id) })
}
