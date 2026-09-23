/**
 * GET  /api/marketing/campaign          — list user's campaigns
 * POST /api/marketing/campaign          — create new campaign
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { getBnbContext } from '@/lib/bnb/context'

// 客服工作台的「行銷專案」（知識庫文字、折扣禮品、活動素材…）跟著目前操作中的
// 業務走，不是永遠綁登入者自己——理由跟 cs-datasource 等其他 CS 相關路由一致。
// 沒有 CS/訂房業務的一般個人行銷使用者，ctx.ownerId 就是自己，行為不變。
async function resolveOwnerId(supabase: Awaited<ReturnType<typeof createClient>>, fallbackUserId: string): Promise<string> {
  const ctx = await getBnbContext(supabase, 'cs')
  return ctx?.ownerId ?? fallbackUserId
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ownerId = await resolveOwnerId(supabase, user.id)

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('id, title, topic, industry, company_name, status, active_step, created_at, updated_at, unit_data')
    .eq('user_id', ownerId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false }) // updated_at 相同時（例如批次搬移資料造成的並列）改用建立時間決勝負，永遠是「最新的那筆」
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ownerId = await resolveOwnerId(supabase, user.id)

  const body = await req.json()

  // 方案行銷案數上限（free 1 / pro 10 / team+ 無限）——額度屬於業務擁有者的方案
  const { plan, features } = await getMarketingEntitlements(supabase, ownerId)
  if (Number.isFinite(features.campaignLimit)) {
    const { count } = await supabase
      .from('marketing_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .neq('status', 'archived')
      .neq('title', '__prospect__') // 潛在客戶行銷的內部設定列，不占名額
    if ((count ?? 0) >= features.campaignLimit) {
      return NextResponse.json(
        { error: `已達方案行銷案數上限（${features.campaignLimit} 個），請升級方案或封存舊行銷案`, plan, limit: features.campaignLimit },
        { status: 403 },
      )
    }
  }

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .insert({
      user_id: ownerId,
      title: body.title ?? '未命名行銷活動',
      topic: body.topic,
      industry: body.industry,
      company_name: body.companyName,
      company_info: body.companyInfo,
      telegram_chat_id: body.telegramChatId,
      selected_platforms: body.selectedPlatforms ?? ['Facebook', 'Instagram'],
      step_statuses: body.stepStatuses ?? {},
      feedbacks: body.feedbacks ?? {},
      active_step: body.activeStep ?? 1,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
