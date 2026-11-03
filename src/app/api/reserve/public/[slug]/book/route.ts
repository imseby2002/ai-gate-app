import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_STORE, DEFAULT_SERVICES } from '@/lib/reserve/mock-data'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json()
    const {
      service_id,
      staff_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_notes,
      start_time,
    } = body

    if (!service_id || !customer_name || !customer_phone || !start_time) {
      return NextResponse.json({ error: '請填寫完整的預約資訊（服務項目、姓名、手機、時段）' }, { status: 400 })
    }

    const admin = createAdminClient()

    let storeId = DEFAULT_STORE.id
    const { data: storeData } = await admin
      .from('reserve_stores')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle()

    if (storeData) {
      storeId = storeData.id
    }

    // Determine service duration to compute end_time
    let durationMinutes = 60
    let price = 0
    let serviceName = '精選服務'

    const { data: srvData } = await admin
      .from('reserve_services')
      .select('name, duration_minutes, price, sale_price')
      .eq('id', service_id)
      .maybeSingle()

    if (srvData) {
      durationMinutes = srvData.duration_minutes || 60
      price = srvData.sale_price ?? srvData.price ?? 0
      serviceName = srvData.name
    } else {
      const mockSrv = DEFAULT_SERVICES.find(s => s.id === service_id)
      if (mockSrv) {
        durationMinutes = mockSrv.duration_minutes
        price = mockSrv.sale_price ?? mockSrv.price
        serviceName = mockSrv.name
      }
    }

    const startDate = new Date(start_time)
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000)
    const end_time = endDate.toISOString()

    const datePrefix = startDate.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    const appointment_no = `APT-${datePrefix}-${rand}`

    // Insert into DB if store exists in DB
    let appointment = {
      id: `apt-${Date.now()}`,
      appointment_no,
      store_id: storeId,
      service_id,
      staff_id: staff_id || null,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      customer_notes: customer_notes || null,
      start_time: startDate.toISOString(),
      end_time,
      status: 'pending',
      total_price: price,
      payment_status: 'unpaid',
      created_at: new Date().toISOString(),
      service_name: serviceName,
    }

    if (storeData) {
      const { data: inserted, error: insertError } = await admin
        .from('reserve_appointments')
        .insert({
          appointment_no,
          store_id: storeId,
          service_id,
          staff_id: staff_id || null,
          customer_name,
          customer_phone,
          customer_email: customer_email || null,
          customer_notes: customer_notes || null,
          start_time: startDate.toISOString(),
          end_time,
          status: 'pending',
          total_price: price,
          payment_status: 'unpaid',
        })
        .select()
        .single()

      if (!insertError && inserted) {
        appointment = { ...appointment, ...inserted, service_name: serviceName }
      }

      // Upsert customer in CRM
      try {
        await admin.from('reserve_customers').upsert({
          store_id: storeId,
          name: customer_name,
          phone: customer_phone,
          email: customer_email || null,
          last_visit_at: startDate.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id,phone' })
      } catch (crmErr) {
        console.warn('[crm-upsert-public-warn]', crmErr)
      }
    }

    return NextResponse.json({
      success: true,
      appointment,
      message: '預約已送出！店家將盡快為您確認。',
    })
  } catch (err: any) {
    console.error('[reserve-public-book]', err)
    return NextResponse.json({ error: err.message || '預約失敗，請稍後再試' }, { status: 500 })
  }
}
