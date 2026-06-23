/**
 * POST /api/ivr/calls/start
 * 觸發 Bird 外撥。body: { campaign_id, phones: string[] }
 * 需登入；以 session 確認對 campaign 的存取權（RLS），再建 ivr_calls 並外撥。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startBirdCall } from '@/lib/ivr/dispatch'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const campaignId: string | undefined = body?.campaign_id
  const phones: string[] = Array.isArray(body?.phones)
    ? body.phones.map((p: unknown) => String(p).trim()).filter(Boolean)
    : []
  if (!campaignId || phones.length === 0) {
    return NextResponse.json({ error: 'campaign_id_and_phones_required' }, { status: 400 })
  }

  // RLS 會過濾不可存取的 campaign
  const { data: campaign } = await supabase
    .from('ivr_campaigns')
    .select('id, user_id, is_active')
    .eq('id', campaignId)
    .single()
  if (!campaign) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 })
  if (!campaign.is_active) return NextResponse.json({ error: 'campaign_inactive' }, { status: 409 })

  const results: Array<{ phone: string; call_id: string | null; dialed: boolean }> = []

  for (const phone of phones) {
    // 先建立通話列（user_id = campaign.user_id，確保營運資料歸屬一致）
    const { data: call } = await supabase
      .from('ivr_calls')
      .insert({ user_id: campaign.user_id, campaign_id: campaign.id, phone, status: 'dialing' })
      .select('id')
      .single()

    const providerCallId = await startBirdCall(phone).catch(() => null)
    if (call?.id) {
      await supabase
        .from('ivr_calls')
        .update({
          provider_call_id: providerCallId,
          status: providerCallId ? 'dialing' : 'failed',
          ...(providerCallId ? {} : { ended_at: new Date().toISOString() }),
        })
        .eq('id', call.id)
    }
    results.push({ phone, call_id: call?.id ?? null, dialed: !!providerCallId })
  }

  return NextResponse.json({ results })
}
