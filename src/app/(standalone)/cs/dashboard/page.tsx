import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { CsDashboard } from '../CsDashboard'

// 總覽頁：原本 /cs 每次都會先顯示這頁的總覽卡片/快速入口，改成獨立頁面，
// 日常入口直接進 /cs/inbox，想看今日訊息/待處理工單數字或找其他功能的人才點進來。
export default async function CsDashboardPage() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/login')
  const ownerId = ctx.ownerId

  const [{ count: credCount }, { count: dsCount }, { count: msgCount }] = await Promise.all([
    supabase.from('social_platform_credentials').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('cs_data_sources').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('cs_messages').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
  ])
  const hasFootprint = (credCount ?? 0) > 0 || (dsCount ?? 0) > 0 || (msgCount ?? 0) > 0

  // 完全沒有 CS 足跡的全新用戶不該直接看到總覽頁（統計數字都是空的），導回 /cs 走行業選擇流程
  if (!hasFootprint) redirect('/cs')

  const [
    { data: sources },
    { count: todayMessages },
    { count: openTickets },
    { data: channels },
    { count: everMessages },
    { data: nudges },
  ] = await Promise.all([
    supabase
      .from('cs_data_sources')
      .select('industry')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('cs_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    supabase
      .from('cs_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('social_platform_credentials')
      .select('platform')
      .eq('user_id', ownerId)
      .eq('is_connected', true),
    // 站內引導 checklist 用：曾經（不限今日）收過任何一則顧客訊息，代表已成功活化
    supabase
      .from('cs_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId),
    // 免費層升級提示：客人傳照片/客訴但目前方案未解鎖，7 天內最近一筆
    supabase
      .from('cs_upgrade_nudges')
      .select('reason, customer_message, created_at')
      .eq('user_id', ownerId)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const industry = sources?.[0]?.industry ?? 'homestay'

  return (
    <CsDashboard
      industry={industry}
      todayMessages={todayMessages ?? 0}
      openTickets={openTickets ?? 0}
      connectedPlatforms={(channels ?? []).map((c: { platform: string }) => c.platform)}
      hasMessages={(everMessages ?? 0) > 0}
      upgradeNudge={nudges?.[0] as { reason: 'image' | 'complaint'; customer_message: string | null } | undefined ?? null}
    />
  )
}
