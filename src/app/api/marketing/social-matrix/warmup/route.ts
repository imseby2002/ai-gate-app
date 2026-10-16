import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { alreadyAdvancedToday, healthForDay, planWarmup, MATURE_DAY } from '@/lib/social-matrix/warmup'
import type { SocialAccount } from '@/lib/social-matrix/types'
import { fetchSocialLogs } from '@/lib/social-matrix/logs'


export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  return NextResponse.json({ logs: await fetchSocialLogs(await createClient()) })
}

// 產生「今日養號任務」並推進天數（系統不會自動操作社群帳號；同帳號每天只推進一次）
export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const { account_id, run_all } = await req.json().catch(() => ({}))
  const supabase = await createClient()
  let q = supabase.from('marketing_social_accounts').select('*')
  q = run_all ? q.in('status', ['warming', 'mature']) : q.eq('id', account_id ?? '')
  const { data: accounts, error } = await q
  if (error) return NextResponse.json({ error: `讀取帳號失敗：${error.message}` }, { status: 500 })
  if (!accounts?.length) return NextResponse.json({ error: '找不到指定執行養號的帳號' }, { status: 400 })

  const now = new Date()
  const results = []
  for (const acc of accounts as SocialAccount[]) {
    if (alreadyAdvancedToday(acc, now)) {
      results.push({ account_id: acc.id, account_name: acc.account_name, platform: acc.platform, skipped: true, reason: '今天已產生過養號任務' })
      continue
    }
    const plan = planWarmup(acc)
    const nextStatus = plan.nextDay >= MATURE_DAY ? 'mature' : 'warming'
    await supabase.from('marketing_social_accounts').update({
      warmup_day: plan.nextDay,
      health_score: healthForDay(plan.nextDay),
      status: acc.status === 'warming' || acc.status === 'mature' ? nextStatus : acc.status,
      last_action_at: now.toISOString(),
      daily_actions_count: (acc.daily_actions_count ?? 0) + 1,
      updated_at: now.toISOString(),
    }).eq('id', acc.id)
    await supabase.from('marketing_social_logs').insert({
      user_id: guard.user.id,
      account_id: acc.id,
      action_type: plan.actionType,
      details: plan.details,
      status: 'success',
    })
    results.push({ account_id: acc.id, account_name: acc.account_name, platform: acc.platform, next_day: plan.nextDay, details: plan.details })
  }

  const { data: updated } = await supabase
    .from('marketing_social_accounts')
    .select('*, proxy:marketing_proxies(*)')
    .order('created_at', { ascending: false })
  return NextResponse.json({
    success: true,
    processed_count: results.filter(r => !('skipped' in r)).length,
    results,
    updated_accounts: updated ?? [],
    latest_logs: await fetchSocialLogs(supabase),
  })
}
