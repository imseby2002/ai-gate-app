import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_integrations')
    .select('email, token_expiry, created_at')
    .eq('user_id', user.id)
    .eq('provider', 'google_drive')
    .single()

  if (!data) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, email: data.email, since: data.created_at })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('user_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google_drive')

  return NextResponse.json({ ok: true })
}
