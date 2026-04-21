/**
 * GET  /api/social/credentials        — 取得所有平台憑證 (credentials 欄位加密不回傳，只回傳 is_connected)
 * POST /api/social/credentials        — 儲存或更新平台憑證
 * DELETE /api/social/credentials?platform=xxx — 清除平台憑證
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('social_platform_credentials')
    .select('platform, is_connected, credentials')
    .eq('user_id', user.id)

  // Mask sensitive values — only expose non-secret fields for display
  const result: Record<string, { is_connected: boolean; preview: Record<string, string> }> = {}
  for (const row of data ?? []) {
    const preview: Record<string, string> = {}
    for (const [k, v] of Object.entries(row.credentials as Record<string, string>)) {
      // show last 4 chars of secrets
      const s = String(v)
      preview[k] = s.length > 8 ? '••••' + s.slice(-4) : s ? '••••' : ''
    }
    result[row.platform] = { is_connected: row.is_connected, preview }
  }

  return NextResponse.json({ platforms: result })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, credentials } = await req.json()
  if (!platform || !credentials) return NextResponse.json({ error: 'platform and credentials required' }, { status: 400 })

  // Detect if any credential field is non-empty to mark as connected
  const is_connected = Object.values(credentials as Record<string, string>).some(v => String(v).trim() !== '')

  const { error } = await supabase
    .from('social_platform_credentials')
    .upsert({ user_id: user.id, platform, credentials, is_connected }, { onConflict: 'user_id,platform' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
