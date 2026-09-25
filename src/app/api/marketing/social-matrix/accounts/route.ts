import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'
import { SocialPlatform } from '@/lib/social-matrix/types'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const supabase = await createClient()
    const { data: accounts, error } = await supabase
      .from('marketing_social_accounts')
      .select('*, proxy:marketing_proxies(*)')
      .order('created_at', { ascending: false })

    if (error || !accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: StorageService.getAccounts() })
    }

    return NextResponse.json({ accounts })
  } catch (err) {
    console.warn('[accounts] Using in-memory fallback:', err)
    return NextResponse.json({ accounts: StorageService.getAccounts() })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const body = await req.json()
    const {
      platform,
      account_name,
      account_handle,
      proxy_id,
      warmup_day = 1,
      target_niches = [],
    } = body

    if (!platform || !account_name) {
      return NextResponse.json({ error: '請提供平台類型與帳號名稱' }, { status: 400 })
    }

    const initialHealth = warmup_day >= 12 ? 90 : Math.max(50, 50 + (warmup_day * 3))
    const initialStatus = warmup_day >= 12 ? 'mature' : 'warming'

    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('marketing_social_accounts')
        .insert({
          user_id: authUser.id,
          platform: platform as SocialPlatform,
          account_name,
          account_handle: account_handle || `@${account_name.toLowerCase().replace(/\s+/g, '_')}`,
          proxy_id: proxy_id || null,
          warmup_day: Number(warmup_day),
          status: initialStatus,
          health_score: initialHealth,
          daily_actions_count: 0,
          max_daily_actions: 5,
          target_niches,
        })
        .select('*, proxy:marketing_proxies(*)')
        .single()

      if (!error && data) {
        return NextResponse.json({ success: true, account: data })
      }
    } catch {
      // ignore, fall through to storage fallback
    }

    const created = StorageService.addAccount({
      platform: platform as SocialPlatform,
      account_name,
      account_handle: account_handle || `@${account_name.toLowerCase().replace(/\s+/g, '_')}`,
      proxy_id: proxy_id || undefined,
      warmup_day: Number(warmup_day),
      status: initialStatus,
      health_score: initialHealth,
      daily_actions_count: 0,
      max_daily_actions: 5,
      target_niches,
    })

    return NextResponse.json({ success: true, account: created })
  } catch (err) {
    return NextResponse.json({ error: `新增帳號失敗: ${String(err)}` }, { status: 500 })
  }
}
