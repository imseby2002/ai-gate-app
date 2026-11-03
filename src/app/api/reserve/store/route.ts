import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_STORE } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ store: DEFAULT_STORE, isDemo: true })
    }

    const { data: store, error } = await supabase
      .from('reserve_stores')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !store) {
      return NextResponse.json({ store: { ...DEFAULT_STORE, user_id: user.id }, isDemo: !store })
    }

    return NextResponse.json({ store, isDemo: false })
  } catch (err: any) {
    console.error('[reserve-store-get]', err)
    return NextResponse.json({ store: DEFAULT_STORE, isDemo: true })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('reserve_stores')
      .upsert({
        ...body,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ store: data })
  } catch (err: any) {
    console.error('[reserve-store-post]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
