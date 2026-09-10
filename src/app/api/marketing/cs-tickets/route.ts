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

  const { data: rawTickets, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickets = rawTickets ?? []

  // 取得缺漏或非人類可讀的客戶姓名，統一從 cs_customers 補齊，確保與收件匣 100% 一致
  const missingFromIds = Array.from(new Set(
    tickets
      .filter(t => t.from_id && (!t.from_name?.trim() || t.from_name.startsWith('LINE 客戶')))
      .map(t => t.from_id as string)
  ))

  if (missingFromIds.length > 0) {
    const { data: custs } = await supabase
      .from('cs_customers')
      .select('from_id, name')
      .eq('user_id', ctx.ownerId)
      .in('from_id', missingFromIds)

    const nameMap = new Map<string, string>()
    for (const c of custs ?? []) {
      if (c.name?.trim()) {
        nameMap.set(c.from_id, c.name.trim())
      }
    }

    const stillMissing = missingFromIds.filter(id => !nameMap.has(id))
    if (stillMissing.length > 0) {
      const { data: msgs } = await supabase
        .from('cs_messages')
        .select('from_id, from_name')
        .eq('user_id', ctx.ownerId)
        .in('from_id', stillMissing)
        .not('from_name', 'is', null)
        .order('created_at', { ascending: false })

      for (const m of msgs ?? []) {
        if (m.from_name?.trim() && !nameMap.has(m.from_id)) {
          nameMap.set(m.from_id, m.from_name.trim())
        }
      }
    }

    const updates: Array<{ id: string; name: string }> = []
    for (const t of tickets) {
      if (t.from_id && nameMap.has(t.from_id)) {
        t.from_name = nameMap.get(t.from_id)
        updates.push({ id: t.id, name: t.from_name! })
      }
    }

    if (updates.length > 0) {
      void Promise.allSettled(updates.map(u =>
        supabase.from('cs_tickets').update({ from_name: u.name }).eq('id', u.id)
      ))
    }
  }

  return NextResponse.json({ tickets })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    industry = 'homestay', platform = 'test',
    from_id, subject, description,
    priority = 'medium', intent, messages = [], campaign_id,
  } = body
  let { from_name } = body

  // 若建立工單時未帶 from_name，主動從 cs_customers 查詢補足人類可讀名稱
  if (!from_name && from_id) {
    const { data: c } = await supabase
      .from('cs_customers')
      .select('name')
      .eq('user_id', ctx.ownerId)
      .eq('from_id', from_id)
      .maybeSingle()
    if (c?.name?.trim()) {
      from_name = c.name.trim()
    }
  }

  const { data, error } = await supabase
    .from('cs_tickets')
    .insert({ user_id: ctx.ownerId, industry, platform, from_id, from_name, subject, description, priority, intent, messages, campaign_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ticket: data })
}
