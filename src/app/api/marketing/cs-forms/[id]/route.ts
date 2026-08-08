/**
 * GET    /api/marketing/cs-forms/[id]  — 取得單一表單
 * PATCH  /api/marketing/cs-forms/[id]  — 更新表單設定
 * DELETE /api/marketing/cs-forms/[id]  — 刪除表單（連同提交紀錄一併刪除，見 FK cascade）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('cs_forms')
    .select('*')
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ form: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('name' in body) patch.name = body.name
  if ('fields' in body) patch.fields = body.fields
  if ('triggerKeywords' in body) patch.trigger_keywords = body.triggerKeywords
  if ('notifyTarget' in body) patch.notify_target = body.notifyTarget
  if ('enabled' in body) patch.enabled = body.enabled
  if ('availableWeekdays' in body) patch.available_weekdays = body.availableWeekdays
  if ('confirmBeforeFields' in body) patch.confirm_before_fields = body.confirmBeforeFields
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('cs_forms')
    .update(patch)
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('cs_forms')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
