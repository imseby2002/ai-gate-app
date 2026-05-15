/**
 * GET  /api/marketing/company-data  — load shared company data
 * PUT  /api/marketing/company-data  — upsert shared company data
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('company_data')
    .select('data, compiled_md')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ data: data?.data ?? {}, compiled_md: data?.compiled_md ?? null })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { error } = await supabase
    .from('company_data')
    .upsert({ user_id: user.id, data: body }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
