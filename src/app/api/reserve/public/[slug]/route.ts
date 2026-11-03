import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_STORE, DEFAULT_SERVICES, DEFAULT_STAFF } from '@/lib/reserve/mock-data'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    let store = DEFAULT_STORE
    let services = DEFAULT_SERVICES
    let staff = DEFAULT_STAFF

    const { data: storeData } = await admin
      .from('reserve_stores')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (storeData) {
      store = storeData
      const [srvRes, stfRes] = await Promise.all([
        admin.from('reserve_services').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order'),
        admin.from('reserve_staff').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order'),
      ])
      if (srvRes.data && srvRes.data.length > 0) services = srvRes.data
      if (stfRes.data && stfRes.data.length > 0) staff = stfRes.data
    }

    return NextResponse.json({
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
        category: store.category,
        description: store.description,
        phone: store.phone,
        email: store.email,
        address: store.address,
        cover_url: store.cover_url,
        logo_url: store.logo_url,
        business_hours: store.business_hours,
        slot_interval_minutes: store.slot_interval_minutes,
        deposit_required: store.deposit_required,
        deposit_amount: store.deposit_amount,
        currency: store.currency,
        notice: store.notice,
      },
      services,
      staff,
    })
  } catch (err: any) {
    console.error('[reserve-public-get]', err)
    return NextResponse.json({
      store: DEFAULT_STORE,
      services: DEFAULT_SERVICES,
      staff: DEFAULT_STAFF,
    })
  }
}
