import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { CsLanding } from './CsLanding'
import { CsDashboard } from './CsDashboard'

export default async function CsPage({
  searchParams,
}: {
  searchParams: Promise<{ select?: string }>
}) {
  const supabase = await createClient()
  // 用 getBnbContext 解析出實際操作的民宿 ownerId（跟其他 CS API 一致）：
  // 協作者自己名下不會有平台綁定與訊息（都記在擁有者名下），直接用
  // user.id 查會把協作者誤判成全新用戶、永遠顯示宣傳頁與空白統計。
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/login')
  const ownerId = ctx.ownerId

  const sp = await searchParams

  // ?select=1 → 強制顯示行業選擇頁（已設定用戶換行業）
  if (sp.select) return <CsLanding />

  // 檢查是否已設定：cs_data_sources 只有 PRO+ 手動加資料來源才會有記錄，免費／
  // 一般用戶就算已經綁好頻道、正常在用，也永遠不會有這張表的資料——用它當
  // 「是否已設定」的判斷依據，會讓已經在用的用戶每次都被導回行銷宣傳頁。
  // 改用「是否已綁定任一平台」（social_platform_credentials）判斷，才是所有
  // 方案都適用的活化訊號。
  const { count: platformCount } = await supabase
    .from('social_platform_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .eq('is_connected', true)

  // 尚未設定 → 顯示行業選擇 landing
  if ((platformCount ?? 0) === 0) return <CsLanding />

  // 已設定 → 取行業、統計資料，顯示工作台
  const [
    { data: sources },
    { count: todayMessages },
    { count: openTickets },
    { data: channels },
    { count: everMessages },
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
  ])

  const industry = sources?.[0]?.industry ?? 'homestay'

  return (
    <CsDashboard
      industry={industry}
      todayMessages={todayMessages ?? 0}
      openTickets={openTickets ?? 0}
      connectedPlatforms={(channels ?? []).map((c: { platform: string }) => c.platform)}
      hasMessages={(everMessages ?? 0) > 0}
    />
  )
}
