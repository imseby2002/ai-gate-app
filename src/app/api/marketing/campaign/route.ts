/**
 * GET  /api/marketing/campaign          — list user's campaigns
 * POST /api/marketing/campaign          — create new campaign
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('id, title, topic, company_name, status, active_step, created_at, updated_at')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .insert({
      user_id: user.id,
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
