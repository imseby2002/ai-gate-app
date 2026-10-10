import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { healthForDay, MATURE_DAY } from '@/lib/social-matrix/warmup'
import type { SocialPlatform } from '@/lib/social-matrix/types'

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'threads', 'tiktok', 'dcard', 'x']

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_social_accounts')
    .select('*, proxy:marketing_proxies(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: `讀取帳號失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const body = await req.json().catch(() => ({}))
  const { platform, account_name, account_handle, proxy_id, target_niches = [] } = body
  if (!PLATFORMS.includes(platform) || !account_name?.trim()) {
    return NextResponse.json({ error: '請提供平台類型與帳號名稱' }, { status: 400 })
  }
  const warmupDay = Math.max(1, Math.min(30, Number(body.warmup_day) || 1))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_social_accounts')
    .insert({
      user_id: guard.user.id,
      platform,
      account_name: account_name.trim(),
      account_handle: account_handle || `@${account_name.trim().toLowerCase().replace(/\s+/g, '_')}`,
      proxy_id: proxy_id || null,
      warmup_day: warmupDay,
      status: warmupDay >= MATURE_DAY ? 'mature' : 'warming',
      health_score: healthForDay(warmupDay),
      daily_actions_count: 0,
      max_daily_actions: 5,
      target_niches: Array.isArray(target_niches) ? target_niches : [],
    })
    .select('*, proxy:marketing_proxies(*)')
    .single()
  if (error) return NextResponse.json({ error: `新增帳號失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, account: data })
}
