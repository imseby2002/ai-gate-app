import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .eq('user_id', ctx.ownerId)

  return NextResponse.json({ templates: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, subject, body_html, enabled } = await req.json()
  if (!type) return NextResponse.json({ error: 'type 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('email_templates')
    .upsert({ user_id: ctx.ownerId, type, subject, body_html, enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id,type' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}
