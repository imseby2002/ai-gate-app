import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_STAFF } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ staff: DEFAULT_STAFF, isDemo: true })
    }

    const { data: store } = await supabase
      .from('reserve_stores')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.json({ staff: DEFAULT_STAFF, isDemo: true })
    }

    const { data: staff, error } = await supabase
      .from('reserve_staff')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true })

    if (error || !staff || staff.length === 0) {
      return NextResponse.json({ staff: DEFAULT_STAFF, isDemo: true })
    }

    return NextResponse.json({ staff, isDemo: false })
  } catch (err: any) {
    console.error('[reserve-staff-get]', err)
    return NextResponse.json({ staff: DEFAULT_STAFF, isDemo: true })
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
      .from('reserve_staff')
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

    return NextResponse.json({ staff: data })
  } catch (err: any) {
    console.error('[reserve-staff-post]', err)
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
    if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('reserve_staff')
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

    return NextResponse.json({ staff: data })
  } catch (err: any) {
    console.error('[reserve-staff-put]', err)
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
    const { error } = await admin.from('reserve_staff').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[reserve-staff-delete]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
