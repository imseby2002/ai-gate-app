/**
 * GET  /api/marketing/cs-followup-config  — 讀取自動跟進開關
 * POST /api/marketing/cs-followup-config  — 設定自動跟進開關 { enabled: boolean }
 *
 * 開關存於 cs_data_sources(type='auto_followup')，cron /api/cron/cs-followup 據此挑租戶。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await createAdminClient()
    .from('cs_data_sources')
    .select('enabled')
    .eq('user_id', ctx.ownerId)
    .eq('type', 'auto_followup')
    .maybeSingle()

  return NextResponse.json({ enabled: !!data?.enabled })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '沒有修改設定的權限' }, { status: 403 })

  const { enabled } = await req.json()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('cs_data_sources')
    .select('id')
    .eq('user_id', ctx.ownerId)
    .eq('type', 'auto_followup')
    .maybeSingle()

  if (existing?.id) {
    await admin.from('cs_data_sources')
      .update({ enabled: !!enabled, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await admin.from('cs_data_sources').insert({
      user_id: ctx.ownerId, type: 'auto_followup', name: '自動跟進',
      industry: 'homestay', enabled: !!enabled, config: {},
    })
  }

  return NextResponse.json({ ok: true })
}
