/**
 * GET  /api/ivr/campaigns  列出活動與按鍵對應
 * POST /api/ivr/campaigns  建立活動（含按鍵對應）
 *
 * 需登入。寫入由 RLS settings_owner_ids('ivr') 把關（持有人/ivr-admin 可寫）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CHANNELS = ['line', 'whatsapp', 'zalo'] as const
const TARGETS = ['personal', 'group', 'official'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: campaigns } = await supabase
    .from('ivr_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  const ids = (campaigns ?? []).map((c) => c.id)
  const { data: mappings } = ids.length
    ? await supabase.from('ivr_key_mappings').select('*').in('campaign_id', ids)
    : { data: [] as Record<string, unknown>[] }

  return NextResponse.json({
    campaigns: (campaigns ?? []).map((c) => ({
      ...c,
      mappings: (mappings ?? []).filter((m) => m.campaign_id === c.id),
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const mappings: Array<{ digit: string; channel: string; target_type?: string; join_url: string; label?: string }> =
    Array.isArray(body.mappings) ? body.mappings : []

  // 驗證按鍵對應
  const seen = new Set<string>()
  for (const m of mappings) {
    if (!m.digit || !/^[0-9]$/.test(m.digit)) return NextResponse.json({ error: 'bad_digit' }, { status: 400 })
    if (seen.has(m.digit)) return NextResponse.json({ error: 'duplicate_digit' }, { status: 400 })
    seen.add(m.digit)
    if (!CHANNELS.includes(m.channel as typeof CHANNELS[number])) return NextResponse.json({ error: 'bad_channel' }, { status: 400 })
    if (m.target_type && !TARGETS.includes(m.target_type as typeof TARGETS[number])) return NextResponse.json({ error: 'bad_target' }, { status: 400 })
    if (!m.join_url) return NextResponse.json({ error: 'join_url_required' }, { status: 400 })
  }

  const { data: campaign, error } = await supabase
    .from('ivr_campaigns')
    .insert({ user_id: user.id, name: body.name, voice_script: body.voice_script ?? null })
    .select()
    .single()

  if (error || !campaign) return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 403 })

  if (mappings.length) {
    const rows = mappings.map((m) => ({
      user_id: user.id,
      campaign_id: campaign.id,
      digit: m.digit,
      channel: m.channel,
      target_type: m.target_type ?? 'official',
      join_url: m.join_url,
      label: m.label ?? null,
    }))
    const { error: mErr } = await supabase.from('ivr_key_mappings').insert(rows)
    if (mErr) return NextResponse.json({ error: mErr.message, campaign }, { status: 207 })
  }

  return NextResponse.json({ campaign }, { status: 201 })
}
