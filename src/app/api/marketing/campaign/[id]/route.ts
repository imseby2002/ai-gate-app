/**
 * GET    /api/marketing/campaign/[id]  — load full campaign
 * PATCH  /api/marketing/campaign/[id]  — update campaign state
 * DELETE /api/marketing/campaign/[id]  — archive campaign
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

type Params = { params: Promise<{ id: string }> }

// 比照 /api/marketing/campaign 的 resolveOwnerId：跟著目前操作中的業務走
async function resolveOwnerId(supabase: Awaited<ReturnType<typeof createClient>>, fallbackUserId: string): Promise<string> {
  const ctx = await getBnbContext(supabase, 'cs')
  return ctx?.ownerId ?? fallbackUserId
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ownerId = await resolveOwnerId(supabase, user.id)

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ campaign: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ownerId = await resolveOwnerId(supabase, user.id)

  const body = await req.json()

  // Map frontend camelCase → DB snake_case
  const patch: Record<string, unknown> = {}
  if ('title'             in body) patch.title              = body.title
  if ('topic'             in body) patch.topic              = body.topic
  if ('industry'          in body) patch.industry           = body.industry
  if ('companyName'       in body) patch.company_name       = body.companyName
  if ('companyInfo'       in body) patch.company_info       = body.companyInfo
  if ('stepStatuses'      in body) patch.step_statuses      = body.stepStatuses
  if ('activeStep'        in body) patch.active_step        = body.activeStep
  if ('collectedData'     in body) patch.collected_data     = body.collectedData
  if ('analysis'          in body) patch.analysis           = body.analysis
  if ('metrics'           in body) patch.metrics            = body.metrics
  if ('copyText'          in body) patch.copy_text          = body.copyText
  if ('imageUrls'         in body) patch.image_urls         = body.imageUrls
  if ('scriptText'        in body) patch.script_text        = body.scriptText
  if ('videoJobId'        in body) patch.video_job_id       = body.videoJobId
  if ('telegramChatId'    in body) patch.telegram_chat_id   = body.telegramChatId
  if ('selectedPlatforms' in body) patch.selected_platforms = body.selectedPlatforms
  if ('feedbacks'         in body) patch.feedbacks          = body.feedbacks
  if ('status'            in body) patch.status             = body.status
  if ('unit_data'         in body) {
    const { data: existing } = await supabase
      .from('marketing_campaigns')
      .select('unit_data')
      .eq('id', id)
      .single()
    patch.unit_data = { ...(existing?.unit_data ?? {}), ...(body.unit_data as object) }
  }
  if ('unit_statuses'     in body) patch.unit_statuses      = body.unit_statuses

  const { error } = await supabase
    .from('marketing_campaigns')
    .update(patch)
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ownerId = await resolveOwnerId(supabase, user.id)

  const { error } = await supabase
    .from('marketing_campaigns')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
