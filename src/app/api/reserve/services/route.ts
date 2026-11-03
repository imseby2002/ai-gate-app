import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_SERVICES } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ services: DEFAULT_SERVICES, isDemo: true })
    }

    const { data: store } = await supabase
      .from('reserve_stores')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.json({ services: DEFAULT_SERVICES, isDemo: true })
    }

    const { data: services, error } = await supabase
      .from('reserve_services')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true })

    if (error || !services || services.length === 0) {
      return NextResponse.json({ services: DEFAULT_SERVICES, isDemo: true })
    }

    return NextResponse.json({ services, isDemo: false })
  } catch (err: any) {
    console.error('[reserve-services-get]', err)
    return NextResponse.json({ services: DEFAULT_SERVICES, isDemo: true })
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

    // Ensure store exists
    let { data: store } = await admin
      .from('reserve_stores')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!store) {
      const { data: newStore } = await admin
        .from('reserve_stores')
        .insert({
          user_id: user.id,
          name: '我的預約門市',
          slug: `store-${user.id.slice(0, 8)}`,
          category: 'beauty',
        })
        .select()
        .single()
      store = newStore
    }

    const { data, error } = await admin
      .from('reserve_services')
      .insert({
        ...body,
        store_id: store?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ service: data })
  } catch (err: any) {
    console.error('[reserve-services-post]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing service id' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('reserve_services')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ service: data })
  } catch (err: any) {
    console.error('[reserve-services-put]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('reserve_services').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[reserve-services-delete]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
