import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAvailableSlots } from '@/lib/reserve/slots'
import { DEFAULT_STORE, DEFAULT_SERVICES, DEFAULT_STAFF, generateInitialAppointments } from '@/lib/reserve/mock-data'
import { ReserveStore, ReserveService, ReserveStaff, ReserveAppointment } from '@/lib/reserve/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date') // 'YYYY-MM-DD'
    const serviceId = searchParams.get('service_id')
    const staffId = searchParams.get('staff_id')
    const storeSlug = searchParams.get('slug')

    if (!dateStr || !serviceId) {
      return NextResponse.json({ error: 'Missing date or service_id' }, { status: 400 })
    }

    const admin = createAdminClient()

    let store: ReserveStore = DEFAULT_STORE
    let services: ReserveService[] = DEFAULT_SERVICES
    let staffList: ReserveStaff[] = DEFAULT_STAFF
    let appointments: ReserveAppointment[] = generateInitialAppointments(dateStr)

    if (storeSlug) {
      const { data: storeData } = await admin
        .from('reserve_stores')
        .select('*')
        .eq('slug', storeSlug)
        .maybeSingle()

      if (storeData) {
        store = storeData
        const [srvRes, stfRes, aptRes] = await Promise.all([
          admin.from('reserve_services').select('*').eq('store_id', store.id).eq('is_active', true),
          admin.from('reserve_staff').select('*').eq('store_id', store.id).eq('is_active', true),
          admin.from('reserve_appointments').select('*').eq('store_id', store.id),
        ])
        if (srvRes.data && srvRes.data.length > 0) services = srvRes.data
        if (stfRes.data && stfRes.data.length > 0) staffList = stfRes.data
        if (aptRes.data && aptRes.data.length > 0) appointments = aptRes.data
      }
    }

    const service = services.find(s => s.id === serviceId)
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const slots = computeAvailableSlots({
      dateStr,
      store,
      service,
      staffList,
      appointments,
      selectedStaffId: staffId && staffId !== 'any' ? staffId : null,
    })

    return NextResponse.json({ slots, service, store: { name: store.name, category: store.category } })
  } catch (err: any) {
    console.error('[reserve-slots-get]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
