/**
 * GET  /api/social/credentials        — 取得所有平台憑證
 * POST /api/social/credentials        — 儲存或更新平台憑證（空白欄位保留原值）
 * DELETE /api/social/credentials?platform=xxx — 清除平台憑證
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCsEntitlements } from '@/lib/cs/entitlements'

// Fields that are NOT sensitive and can be returned as plain text
const NON_SECRET_FIELDS = new Set([
  'whatsapp_phone_number_id',
  'whatsapp_verify_token',
  'telegram_admin_chat_id',
  'wechat_app_id',
  'zalo_oa_id',
  'whatsapp_personal_bridge_url',
])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('social_platform_credentials')
    .select('platform, is_connected, credentials')
    .eq('user_id', user.id)

  const result: Record<string, {
    is_connected: boolean
    preview: Record<string, string>   // masked for display
    values: Record<string, string>    // actual values for non-secret fields only
  }> = {}

  for (const row of data ?? []) {
    const creds = row.credentials as Record<string, string>
    const preview: Record<string, string> = {}
    const values: Record<string, string> = {}

    for (const [k, v] of Object.entries(creds)) {
      const s = String(v ?? '')
      if (NON_SECRET_FIELDS.has(k)) {
        preview[k] = s  // show actual value for non-secret
        values[k] = s
      } else {
        preview[k] = s.length > 8 ? '••••' + s.slice(-4) : s ? '••••' : ''
        // Don't include secrets in values
      }
    }

    result[row.platform] = { is_connected: row.is_connected, preview, values }
  }

  return NextResponse.json({ platforms: result })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, credentials } = await req.json()
  if (!platform || !credentials) return NextResponse.json({ error: 'platform and credentials required' }, { status: 400 })

  // Merge with existing credentials — empty string fields keep the old value
  const { data: existing } = await supabase
    .from('social_platform_credentials')
    .select('credentials, is_connected')
    .eq('user_id', user.id)
    .eq('platform', platform)
    .single()

  const alreadyConnected = existing?.is_connected ?? false
  const existingCreds = (existing?.credentials as Record<string, string>) ?? {}
  const merged: Record<string, string> = { ...existingCreds }

  for (const [k, v] of Object.entries(credentials as Record<string, string>)) {
    if (String(v).trim() !== '') {
      merged[k] = String(v).trim()  // only overwrite if new value is non-empty
    }
  }

  const is_connected = Object.values(merged).some(v => String(v).trim() !== '')

  // 方案的平台數上限：只在「新增一個尚未連線的平台」時檢查，已連線平台可以繼續編輯憑證
  if (is_connected && !alreadyConnected) {
    const { features } = await getCsEntitlements(supabase, user.id)
    if (Number.isFinite(features.platformLimit)) {
      const { count } = await supabase
        .from('social_platform_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_connected', true)
      if ((count ?? 0) >= features.platformLimit) {
        return NextResponse.json(
          { error: `目前方案最多可綁定 ${features.platformLimit} 個平台，請升級方案或先取消其他平台的綁定。` },
          { status: 403 },
        )
      }
    }
  }

  const { error } = await supabase
    .from('social_platform_credentials')
    .upsert({ user_id: user.id, platform, credentials: merged, is_connected }, { onConflict: 'user_id,platform' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-register Telegram webhook when bot token is saved
  if (platform === 'telegram' && merged.telegram_bot_token) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const webhookUrl = `${appUrl}/api/marketing/cs-webhook/telegram/${user.id}`
    try {
      await fetch(`https://api.telegram.org/bot${merged.telegram_bot_token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      })
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const platform = new URL(req.url).searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 })

  await supabase
    .from('social_platform_credentials')
    .update({ credentials: {}, is_connected: false })
    .eq('user_id', user.id)
    .eq('platform', platform)

  return NextResponse.json({ ok: true })
}
