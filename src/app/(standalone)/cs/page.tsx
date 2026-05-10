import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsLanding } from './CsLanding'
import { CsDashboard } from './CsDashboard'

export default async function CsPage({
  searchParams,
}: {
  searchParams: Promise<{ select?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams

  // ?select=1 → 強制顯示行業選擇頁（已設定用戶換行業）
  if (sp.select) return <CsLanding />

  // 檢查是否已設定（有任何 cs_data_sources 記錄）
  const { count } = await supabase
    .from('cs_data_sources')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // 尚未設定 → 顯示行業選擇 landing
  if ((count ?? 0) === 0) return <CsLanding />

  // 已設定 → 取行業、統計資料，顯示工作台
  const [
    { data: sources },
    { count: todayMessages },
    { count: openTickets },
    { data: channels },
  ] = await Promise.all([
    supabase
      .from('cs_data_sources')
      .select('industry')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('cs_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    supabase
      .from('cs_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('cs_channels')
      .select('platform')
      .eq('user_id', user.id)
      .eq('enabled', true),
  ])

  const industry = sources?.[0]?.industry ?? 'homestay'

  return (
    <CsDashboard
      industry={industry}
      todayMessages={todayMessages ?? 0}
      openTickets={openTickets ?? 0}
      connectedPlatforms={(channels ?? []).map((c: { platform: string }) => c.platform)}
    />
  )
}
