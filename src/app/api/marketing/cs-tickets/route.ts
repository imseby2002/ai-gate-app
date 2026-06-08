import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry') ?? 'homestay'
  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('cs_tickets')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .eq('industry', industry)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    industry = 'homestay', platform = 'test',
    from_id, from_name, subject, description,
    priority = 'medium', intent, messages = [], campaign_id,
  } = body

  const { data, error } = await supabase
    .from('cs_tickets')
    .insert({ user_id: ctx.ownerId, industry, platform, from_id, from_name, subject, description, priority, intent, messages, campaign_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ticket: data })
}
