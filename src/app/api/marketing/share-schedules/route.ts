/**
 * 個人 LINE／Zalo 群組行銷排程（時間到以 Telegram 或 LINE 官方帳號通知持有人一鍵帶入）
 * GET    /api/marketing/share-schedules            最近 30 筆（本人＋同公司）
 * POST   /api/marketing/share-schedules            { app, group_name?, text, holder_id?, run_at, repeat }
 * DELETE /api/marketing/share-schedules?id=xxx     取消
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { lineGroupOwnerIds } from '@/lib/marketing/line-groups'
import { telegramHolders } from '@/lib/marketing/share-drafts'

const COLUMNS = 'id, app, group_name, text, holder_id, next_run_at, repeat, status, last_sent_at, last_result, created_at'

async function auth(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  return user && !user.isCron ? user : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await createAdminClient().from('marketing_share_schedules').select(COLUMNS)
    .in('user_id', await lineGroupOwnerIds(user.id)).neq('status', 'canceled')
    .order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ schedules: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const app = body.app === 'line' || body.app === 'zalo' ? body.app : null
  const text = String(body.text ?? '').trim().slice(0, 4000)
  const repeat = ['once', 'daily', 'weekly'].includes(body.repeat) ? body.repeat : 'once'
  const runAt = new Date(String(body.run_at ?? ''))
  if (!app || !text) return NextResponse.json({ error: '請選擇 App 並填寫文案' }, { status: 400 })
  if (Number.isNaN(runAt.getTime()) || runAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: '請設定未來的時間' }, { status: 400 })
  }
  const holderId = String(body.holder_id ?? '') || null
  if (holderId && !(await telegramHolders(user.id)).some(h => h.id === holderId)) {
    return NextResponse.json({ error: '請選擇已設定 Telegram 的持有人' }, { status: 400 })
  }
  const { data, error } = await createAdminClient().from('marketing_share_schedules').insert({
    user_id: user.id, app, text, repeat, holder_id: holderId,
    group_name: String(body.group_name ?? '').trim().slice(0, 100) || null,
    next_run_at: runAt.toISOString(),
  }).select(COLUMNS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data })
}

export async function DELETE(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  await createAdminClient().from('marketing_share_schedules').update({ status: 'canceled' })
    .eq('id', id).in('user_id', await lineGroupOwnerIds(user.id))
  return NextResponse.json({ success: true })
}
