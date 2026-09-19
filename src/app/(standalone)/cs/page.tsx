import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { CsLanding } from './CsLanding'

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

  // 「行業選擇宣傳頁」(CsLanding) 只應在「完全沒碰過 CS」的全新用戶第一次進來時出現。
  // 只要用戶留下任何 CS 足跡——建立過平台憑證（連線與否都算）、有資料來源、或收過訊息——
  // 就直接進日常真正在用的收件匣，不用每次都先看一遍總覽卡片才能點進去。
  // (先前只看「已連線平台數」，導致還沒接通平台但已在設定的人被誤判)
  const [{ count: credCount }, { count: dsCount }, { count: msgCount }] = await Promise.all([
    supabase.from('social_platform_credentials').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('cs_data_sources').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('cs_messages').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
  ])
  const hasFootprint = (credCount ?? 0) > 0 || (dsCount ?? 0) > 0 || (msgCount ?? 0) > 0

  // 完全沒有 CS 足跡的全新用戶 → 顯示行業選擇 landing
  if (!hasFootprint) return <CsLanding />

  // 已設定 → 日常入口直接進收件匣。總覽卡片/快速入口搬到 /cs/dashboard，想看數字或找
  // 其他功能的人自己點進去，不用每次進 CS 都被擋在總覽頁前面。
  redirect('/cs/inbox')
}
