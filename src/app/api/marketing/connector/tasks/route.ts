// 網頁端對桌面連接器下任務：
//   sync_profiles — 依 AI-GATE 帳號＋代理在 AdsPower 建立／更新設定檔
//   open_profile  — 在客人電腦開啟某社群帳號的 AdsPower 瀏覽器
//   copilot_post  — 開啟瀏覽器、前往目標社團並把文案帶入發文框（由客人自己按發布）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

const TYPES = ['sync_profiles', 'open_profile', 'copilot_post'] as const
type TaskType = (typeof TYPES)[number]

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const { data, error } = await (await createClient())
    .from('marketing_connector_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: `讀取任務失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = guard.user.id

  const body = await req.json().catch(() => ({}))
  const type = body.type as TaskType
  if (!TYPES.includes(type)) return NextResponse.json({ error: '不支援的任務類型' }, { status: 400 })

  const admin = createAdminClient()
  const { count: devices } = await admin
    .from('marketing_connector_devices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (!devices) return NextResponse.json({ error: '尚未配對桌面連接器，請先在電腦安裝並完成配對' }, { status: 409 })

  let accountId: string | null = null
  let deviceId: string | null = null
  const payload: Record<string, unknown> = {}

  if (type !== 'sync_profiles') {
    const { data: acc } = await (await createClient())
      .from('marketing_social_accounts')
      .select('id, adspower_profile_id, connector_device_id')
      .eq('id', body.account_id ?? '')
      .maybeSingle()
    if (!acc) return NextResponse.json({ error: '找不到此社群帳號' }, { status: 404 })
    if (!acc.adspower_profile_id) return NextResponse.json({ error: '此帳號尚未在 AdsPower 建立設定檔，請先執行「同步設定檔」' }, { status: 409 })
    accountId = acc.id
    deviceId = acc.connector_device_id ?? null
  }

  if (type === 'copilot_post') {
    const groupUrl = String(body.group_url ?? '')
    if (!/^https:\/\//.test(groupUrl)) return NextResponse.json({ error: '請提供目標社團網址（https://）' }, { status: 400 })
    const text = String(body.text ?? '').trim()
    if (!text) return NextResponse.json({ error: '文案不可為空' }, { status: 400 })
    Object.assign(payload, {
      group_url: groupUrl,
      group_name: body.group_name ?? null,
      text: text.slice(0, 5000),
      copy_title: body.copy_title ?? null,
      image_urls: Array.isArray(body.image_urls) ? body.image_urls.slice(0, 10) : [],
    })
  }

  const { data: task, error } = await admin
    .from('marketing_connector_tasks')
    .insert({ user_id: userId, device_id: deviceId, account_id: accountId, type, payload })
    .select()
    .single()
  if (error) return NextResponse.json({ error: `建立任務失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, task })
}
