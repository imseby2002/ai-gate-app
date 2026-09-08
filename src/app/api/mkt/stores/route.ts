import { NextRequest, NextResponse } from 'next/server'
import { marketingCompany } from '@/lib/marketing/company'

export async function GET() {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 1. 取得 OFFICE 門市主檔（只取門市或營運據點）
  const { data: stores, error: sErr } = await c.admin
    .from('fin_stores')
    .select('id, code, name, short_name, region, unit_type, address, active')
    .eq('owner_id', c.ownerId)
    .order('code')

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // 2. 取得門市行銷圖文擴充檔
  const { data: profiles, error: pErr } = await c.admin
    .from('mkt_store_profiles')
    .select('*')
    .eq('owner_id', c.ownerId)

  if (pErr) {
    // 若表尚在建立中，容錯回傳基本門市
    console.warn('mkt_store_profiles query warning:', pErr.message)
  }

  const profileMap = new Map<string, any>()
  for (const p of profiles ?? []) {
    profileMap.set(p.store_id, p)
  }

  // 3. 組合回傳：OFFICE 基礎資料 + 行銷擴充資料
  const merged = (stores ?? []).map(s => {
    const prof = profileMap.get(s.id)
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      short_name: s.short_name,
      region: s.region,
      unit_type: s.unit_type,
      address: s.address,
      active: s.active,
      // 行銷圖文欄位
      profile_id: prof?.id ?? null,
      photos: Array.isArray(prof?.photos) ? prof.photos : [],
      story: prof?.story ?? '',
      opening_hours: prof?.opening_hours ?? '',
      google_maps_url: prof?.google_maps_url ?? '',
      delivery_urls: (prof?.delivery_urls && typeof prof.delivery_urls === 'object') ? prof.delivery_urls : {},
      features: Array.isArray(prof?.features) ? prof.features : [],
      updated_at: prof?.updated_at ?? null,
    }
  })

  return NextResponse.json({ stores: merged })
}

export async function PUT(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const storeId = String(body.store_id ?? '').trim()
  if (!storeId) return NextResponse.json({ error: 'store_id 必填' }, { status: 400 })

  const photos = Array.isArray(body.photos) ? body.photos.map(String).filter(Boolean) : []
  const story = String(body.story ?? '').trim()
  const opening_hours = String(body.opening_hours ?? '').trim()
  const google_maps_url = String(body.google_maps_url ?? '').trim()
  const delivery_urls = (body.delivery_urls && typeof body.delivery_urls === 'object') ? body.delivery_urls : {}
  const features = Array.isArray(body.features) ? body.features.map(String).filter(Boolean) : []

  const { data, error } = await c.admin
    .from('mkt_store_profiles')
    .upsert({
      owner_id: c.ownerId,
      store_id: storeId,
      photos,
      story,
      opening_hours,
      google_maps_url,
      delivery_urls,
      features,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,store_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
