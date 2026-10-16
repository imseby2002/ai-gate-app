// POST /api/connector/tasks/[id] — 連接器回報任務結果；copilot_post 確認已發布時寫入社群矩陣紀錄
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireConnectorDevice } from '@/lib/connector/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConnectorDevice(req)
  if (guard.res) return guard.res

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const status = body.status === 'done' ? 'done' : body.status === 'failed' ? 'failed' : null
  if (!status) return NextResponse.json({ error: 'status 需為 done 或 failed' }, { status: 400 })
  const result = typeof body.result === 'object' && body.result ? body.result : {}

  const admin = createAdminClient()
  const { data: task, error } = await admin
    .from('marketing_connector_tasks')
    .update({ status, result, finished_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', guard.device.userId)
    .eq('device_id', guard.device.deviceId)
    .eq('status', 'claimed')
    .select('id, type, account_id, payload')
    .maybeSingle()
  if (error) return NextResponse.json({ error: `回報失敗：${error.message}` }, { status: 500 })
  if (!task) return NextResponse.json({ error: '找不到此任務或狀態不符' }, { status: 404 })

  // 方案 A：連接器只負責開啟社團並帶入文案；回報確認已發布（posted）才記錄發文
  if (task.type === 'copilot_post' && status === 'done' && result.posted === true) {
    const p = (task.payload ?? {}) as { group_name?: string; group_url?: string; copy_title?: string }
    const postUrl = typeof result.post_url === 'string' ? result.post_url : ''
    await admin.from('marketing_social_logs').insert({
      user_id: guard.device.userId,
      account_id: task.account_id,
      action_type: 'post_mode_a',
      details: `【方案 A：桌面連接器 Copilot 發文】已發布至「${p.group_name || p.group_url || '目標社群'}」，文案版本：「${p.copy_title || '未命名文案'}」${postUrl ? `，貼文連結：${postUrl}` : ''}`,
      status: 'success',
    })
  }
  return NextResponse.json({ success: true })
}
