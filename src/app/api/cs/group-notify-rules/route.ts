/**
 * 事件觸發的群組通知規則（訂單確認／行程異動 → Telegram 通知持有人一鍵帶入）
 * GET    /api/cs/group-notify-rules           規則＋可用 Telegram 的持有人
 * POST   /api/cs/group-notify-rules           { event, app, group_name, holder_id }
 * DELETE /api/cs/group-notify-rules?id=xxx
 * 規則存在帳號擁有者（ownerId）名下；需有設定權限
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { telegramHolders } from '@/lib/marketing/share-drafts'

const EVENTS = ['order_confirmed', 'itinerary_changed']

async function ctxOrError() {
  const ctx = await getBnbContext(await createClient(), 'cs')
  if (!ctx) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { ctx }
}

export async function GET() {
  const { ctx, res } = await ctxOrError()
  if (res) return res
  const [{ data: rules }, holders] = await Promise.all([
    createAdminClient().from('marketing_group_notify_rules')
      .select('id, event, app, group_name, holder_id, enabled, created_at')
      .eq('user_id', ctx.ownerId).order('created_at'),
    telegramHolders(ctx.ownerId),
  ])
  return NextResponse.json({ rules: rules ?? [], holders, canSettings: ctx.canSettings })
}

export async function POST(req: NextRequest) {
  const { ctx, res } = await ctxOrError()
  if (res) return res
  if (!ctx.canSettings) return NextResponse.json({ error: '沒有設定權限' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const event = String(body.event ?? '')
  const app = body.app === 'zalo' ? 'zalo' : body.app === 'line' ? 'line' : ''
  const groupName = String(body.group_name ?? '').trim().slice(0, 100)
  const holderId = String(body.holder_id ?? '')
  if (!EVENTS.includes(event) || !app || !groupName) return NextResponse.json({ error: '請填寫事件、App 與群組名稱' }, { status: 400 })
  if (!(await telegramHolders(ctx.ownerId)).some(h => h.id === holderId)) {
    return NextResponse.json({ error: '請選擇已設定 Telegram 的持有人' }, { status: 400 })
  }
  const { data, error } = await createAdminClient().from('marketing_group_notify_rules')
    .insert({ user_id: ctx.ownerId, event, app, group_name: groupName, holder_id: holderId })
    .select('id, event, app, group_name, holder_id, enabled, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest) {
  const { ctx, res } = await ctxOrError()
  if (res) return res
  if (!ctx.canSettings) return NextResponse.json({ error: '沒有設定權限' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  await createAdminClient().from('marketing_group_notify_rules').delete().eq('id', id).eq('user_id', ctx.ownerId)
  return NextResponse.json({ success: true })
}
