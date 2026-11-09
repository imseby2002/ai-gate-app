import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureCurrentStore, getCurrentStore } from '@/lib/reserve/current-store'
import { DEFAULT_CUSTOMERS } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')

    if (!user) {
      let mock = DEFAULT_CUSTOMERS
      if (q) {
        const query = q.toLowerCase()
        mock = mock.filter(c => c.name.toLowerCase().includes(query) || c.phone.includes(query))
      }
      return NextResponse.json({ customers: mock, isDemo: true })
    }

    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id')

    if (!store) {
      return NextResponse.json({ customers: DEFAULT_CUSTOMERS, isDemo: true })
    }

    let query = supabase
      .from('reserve_customers')
      .select('*')
      .eq('store_id', store.id)
      .order('total_spent', { ascending: false })

    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    }

    const { data: customers, error } = await query

    if (error || !customers || customers.length === 0) {
      return NextResponse.json({ customers: DEFAULT_CUSTOMERS, isDemo: true })
    }

    return NextResponse.json({ customers, isDemo: false })
  } catch (err: any) {
    console.error('[reserve-customers-get]', err)
    return NextResponse.json({ customers: DEFAULT_CUSTOMERS, isDemo: true })
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

    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('reserve_customers')
      .upsert({
        ...body,
        store_id: store.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,phone' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ customer: data })
  } catch (err: any) {
    console.error('[reserve-customers-post]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
