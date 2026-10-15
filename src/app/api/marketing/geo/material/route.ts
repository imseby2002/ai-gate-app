/**
 * GET/POST /api/marketing/geo/material
 * GEO 素材庫：與公司資源庫（品牌中樞 mkt_brand、門市 fin_stores/mkt_store_profiles、產品 mkt_product_profiles）全面合併。
 * 支援自動帶入公司品牌與門市資訊、產品規格與賣點為獨家事實，亦保留自訂設定。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentDataOwner, loadCompanyProfile } from '@/lib/company/profile'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. 取得使用者自訂的 geo_material
  const { data: userGeoMat } = await c.admin
    .from('geo_material')
    .select('business, authors, facts')
    .eq('user_id', c.userId)
    .maybeSingle()

  // 2. 取得公司資源庫資料（品牌、門市、產品）
  const companyProfile = await loadCompanyProfile(c.admin, c.ownerId)

  // 3. 取得更詳細門市行銷資訊
  const [storesRes, storeProfilesRes, brandRes] = await Promise.all([
    c.admin
      .from('fin_stores')
      .select('id, name, address, active')
      .eq('owner_id', c.ownerId)
      .order('name'),
    c.admin
      .from('mkt_store_profiles')
      .select('store_id, story, opening_hours, google_maps_url, features')
      .eq('owner_id', c.ownerId),
    c.admin
      .from('mkt_brand')
      .select('platforms, selling_points')
      .eq('owner_id', c.ownerId)
      .maybeSingle(),
  ])

  const storeMap = new Map((storeProfilesRes.data ?? []).map(sp => [sp.store_id, sp]))
  const stores = (storesRes.data ?? []).filter(s => s.active !== false).map(s => {
    const sp = storeMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      address: s.address || '',
      openingHours: sp?.opening_hours || '',
      story: sp?.story || '',
      mapsUrl: sp?.google_maps_url || '',
      features: Array.isArray(sp?.features) ? sp.features : [],
    }
  })

  // 品牌社群連結
  const platformsObj = (brandRes.data?.platforms && typeof brandRes.data.platforms === 'object')
    ? (brandRes.data.platforms as Record<string, string>)
    : {}
  const sameAsUrls = Object.values(platformsObj).filter(v => typeof v === 'string' && /^https?:\/\//i.test(v))

  // 4. 組合商家檔案：優先取使用者設定，若為空則由公司資源庫自動補齊
  const defaultStore = stores[0]
  const business = {
    name: userGeoMat?.business?.name || companyProfile.companyName || defaultStore?.name || '',
    type: userGeoMat?.business?.type || 'LocalBusiness',
    url: userGeoMat?.business?.url || companyProfile.website || '',
    streetAddress: userGeoMat?.business?.streetAddress || defaultStore?.address || companyProfile.address || '',
    city: userGeoMat?.business?.city || '',
    region: userGeoMat?.business?.region || '',
    country: userGeoMat?.business?.country || '',
    openingHours: userGeoMat?.business?.openingHours || defaultStore?.openingHours || '',
    phone: userGeoMat?.business?.phone || '',
    priceRange: userGeoMat?.business?.priceRange || '$$',
    sameAs: userGeoMat?.business?.sameAs?.length ? userGeoMat.business.sameAs : sameAsUrls,
  }

  // 5. 由公司資源庫自動彙整的事實清單 (Company Facts)
  const companyFacts: Array<{ label: string; text: string; source: 'brand' | 'product' | 'store' }> = []

  // 品牌核心賣點與故事
  if (companyProfile.competitiveAdvantage?.trim()) {
    companyFacts.push({
      label: '品牌核心優勢',
      text: companyProfile.competitiveAdvantage.trim(),
      source: 'brand',
    })
  }
  if (companyProfile.description?.trim()) {
    companyFacts.push({
      label: '品牌故事與願景',
      text: companyProfile.description.trim(),
      source: 'brand',
    })
  }

  // 門市特色與地址
  for (const s of stores) {
    const details = [
      s.address ? `地址：${s.address}` : '',
      s.openingHours ? `營業時間：${s.openingHours}` : '',
      s.features?.length ? `特色：${s.features.join('、')}` : '',
      s.story ? `簡介：${s.story}` : '',
    ].filter(Boolean).join('；')
    if (details) {
      companyFacts.push({
        label: `門市：${s.name}`,
        text: `【${s.name}】${details}`,
        source: 'store',
      })
    }
  }

  // 產品與服務規格賣點
  for (const p of companyProfile.productList ?? []) {
    const pDetails = [
      p.category ? `分類：${p.category}` : '',
      p.price ? `售價：NT$ ${p.price}` : '',
      p.slogan ? `訴求：${p.slogan}` : '',
      p.description ? `介紹：${p.description}` : '',
    ].filter(Boolean).join('；')
    companyFacts.push({
      label: `產品：${p.name}`,
      text: `【${p.name}】${pDetails}`,
      source: 'product',
    })
  }

  // 6. E-E-A-T 作者
  const authors = (userGeoMat?.authors && userGeoMat.authors.length > 0)
    ? userGeoMat.authors
    : [{
        name: companyProfile.companyName ? `${companyProfile.companyName} 編輯團隊` : '專業行銷團隊',
        jobTitle: '品牌首席顧問 / 專家團隊',
        bio: `${companyProfile.companyName || '品牌'} 官方專業內容與在地服務團隊`,
        url: companyProfile.website || '',
      }]

  return NextResponse.json({
    business,
    authors,
    facts: userGeoMat?.facts ?? [],
    companyFacts,
    companyStores: stores,
    companyName: companyProfile.companyName || '',
    companyWebsite: companyProfile.website || '',
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { business, authors, facts } = await req.json()
  const { error } = await supabase.from('geo_material').upsert({
    user_id: user.id,
    business: business ?? null,
    authors: Array.isArray(authors) ? authors : [],
    facts: Array.isArray(facts) ? facts : [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    console.error('[geo/material] upsert', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
