import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureCurrentStore, getCurrentStore } from '@/lib/reserve/current-store'
import { generateInitialAppointments } from '@/lib/reserve/mock-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')
    const staffId = searchParams.get('staff_id')
    const q = searchParams.get('q')

    const todayStr = new Date().toISOString().slice(0, 10)

    if (!user) {
      let mock = generateInitialAppointments(todayStr)
      if (status && status !== 'all') mock = mock.filter(m => m.status === status)
      if (staffId && staffId !== 'all') mock = mock.filter(m => m.staff_id === staffId)
      if (q) {
        const query = q.toLowerCase()
        mock = mock.filter(m =>
          m.customer_name.toLowerCase().includes(query) ||
          m.customer_phone.includes(query) ||
          m.appointment_no.toLowerCase().includes(query)
        )
      }
      return NextResponse.json({ appointments: mock, isDemo: true })
    }

    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id')

    if (!store) {
      return NextResponse.json({ appointments: generateInitialAppointments(todayStr), isDemo: true })
    }

    let query = supabase
      .from('reserve_appointments')
      .select('*, service:reserve_services(*), staff:reserve_staff(*)')
      .eq('store_id', store.id)
      .order('start_time', { ascending: true })

    if (from) query = query.gte('start_time', from)
    if (to) query = query.lte('start_time', to)
    if (status && status !== 'all') query = query.eq('status', status)
    if (staffId && staffId !== 'all') query = query.eq('staff_id', staffId)
    if (q) {
      query = query.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,appointment_no.ilike.%${q}%`)
    }

    const { data: appointments, error } = await query

    if (error || !appointments || appointments.length === 0) {
      // Return demo data if empty DB so user immediately sees live sample data
      return NextResponse.json({ appointments: generateInitialAppointments(todayStr), isDemo: true })
    }

    return NextResponse.json({ appointments, isDemo: false })
  } catch (err: any) {
    console.error('[reserve-appointments-get]', err)
    return NextResponse.json({
      appointments: generateInitialAppointments(new Date().toISOString().slice(0, 10)),
      isDemo: true,
    })
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

    // Generate appointment no
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.floor(100 + Math.random() * 900)
    const appointmentNo = body.appointment_no || `APT-${datePrefix}-${randomSuffix}`

    const { data, error } = await admin
      .from('reserve_appointments')
      .insert({
        ...body,
        appointment_no: appointmentNo,
        store_id: store?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*, service:reserve_services(*), staff:reserve_staff(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Upsert customer into CRM
    if (body.customer_name && body.customer_phone) {
      try {
        await admin.from('reserve_customers').upsert({
          store_id: store?.id,
          name: body.customer_name,
          phone: body.customer_phone,
          email: body.customer_email || null,
          last_visit_at: body.start_time,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id,phone' })
      } catch (crmErr) {
        console.warn('[crm-upsert-warn]', crmErr)
      }
    }

    return NextResponse.json({ appointment: data })
  } catch (err: any) {
    console.error('[reserve-appointments-post]', err)
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
    if (!id) return NextResponse.json({ error: 'Missing appointment id' }, { status: 400 })

    const admin = createAdminClient()
    const store = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { data, error } = await admin
      .from('reserve_appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('store_id', store.id)
      .select('*, service:reserve_services(*), staff:reserve_staff(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ appointment: data })
  } catch (err: any) {
    console.error('[reserve-appointments-put]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
