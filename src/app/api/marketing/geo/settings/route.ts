/**
 * GET/POST /api/marketing/geo/settings
 * GEO Writer — 每位使用者的發佈設定（WordPress 憑證 / 通用 Webhook）。
 * GET 不回傳密碼明文，只回傳是否已設定；POST 密碼/Token 留空代表沿用既有值。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('geo_publish_settings')
    .select('wp_base_url, wp_user, wp_app_password, webhook_url, webhook_token')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    wpBaseUrl: data?.wp_base_url ?? '',
    wpUser: data?.wp_user ?? '',
    wpConfigured: !!data?.wp_app_password,
    webhookUrl: data?.webhook_url ?? '',
    webhookConfigured: !!data?.webhook_token,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wpBaseUrl, wpUser, wpAppPassword, webhookUrl, webhookToken } = await req.json()

  // 取既有值，密碼/Token 留空時沿用
  const { data: prev } = await supabase
    .from('geo_publish_settings')
    .select('wp_app_password, webhook_token')
    .eq('user_id', user.id)
    .single()

  const row = {
    user_id: user.id,
    wp_base_url: wpBaseUrl?.trim() || null,
    wp_user: wpUser?.trim() || null,
    wp_app_password: wpAppPassword?.trim() ? wpAppPassword.trim() : (prev?.wp_app_password ?? null),
    webhook_url: webhookUrl?.trim() || null,
    webhook_token: webhookToken?.trim() ? webhookToken.trim() : (prev?.webhook_token ?? null),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('geo_publish_settings').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[geo/settings] upsert', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
