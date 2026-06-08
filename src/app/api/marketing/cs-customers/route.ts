import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

// 客戶追蹤名單：列出此商家的所有 CS 客戶（可依產業／階段篩選）
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const industry = req.nextUrl.searchParams.get('industry')
  const stage = req.nextUrl.searchParams.get('stage')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '200'), 500)

  let q = supabase
    .from('cs_customers')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (industry) q = q.eq('industry', industry)
  if (stage) q = q.eq('stage', stage)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customers: data ?? [] })
}
