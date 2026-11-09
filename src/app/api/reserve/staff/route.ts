import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureCurrentStore, getCurrentStore } from '@/lib/reserve/current-store'
import { DEFAULT_STAFF } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ staff: DEFAULT_STAFF, isDemo: true })
    }

    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id')

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

    const store = await ensureCurrentStore(user.id, req, admin)
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 500 })

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
    const { id, store_id: _ignoredStoreId, ...updates } = body
    void _ignoredStoreId
    if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 })

    const admin = createAdminClient()
    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { data, error } = await admin
      .from('reserve_staff')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('store_id', store.id)
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
    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { error } = await admin.from('reserve_staff').delete().eq('id', id).eq('store_id', store.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[reserve-staff-delete]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
