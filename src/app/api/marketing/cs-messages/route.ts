import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry') ?? 'homestay'
  const platform = req.nextUrl.searchParams.get('platform')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 500)

  let query = supabase
    .from('cs_messages')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .eq('industry', industry)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    industry = 'homestay', platform = 'test',
    from_id = 'test', from_name,
    message, reply, intent, risk, latency_ms,
    campaign_id, ticket_id,
  } = body

  const { data, error } = await supabase
    .from('cs_messages')
    .insert({ user_id: ctx.ownerId, industry, platform, from_id, from_name, message, reply, intent, risk, latency_ms, campaign_id, ticket_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
