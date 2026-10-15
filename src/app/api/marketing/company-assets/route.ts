import { NextResponse } from 'next/server'
import { currentDataOwner } from '@/lib/company/profile'

export interface CompanyMediaAsset {
  id: string
  url: string
  name: string
  category: 'store' | 'product' | 'brand'
  subGroup?: string
}

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [storesRes, productsRes, brandRes] = await Promise.all([
      c.admin
        .from('mkt_store_profiles')
        .select('photos, store_id, fin_stores(id, name, code)')
        .eq('owner_id', c.ownerId),
      c.admin
        .from('mkt_product_profiles')
        .select('id, name, category, images')
        .eq('owner_id', c.ownerId)
        .order('created_at', { ascending: false }),
      c.admin
        .from('mkt_brand')
        .select('files, logo_url')
        .eq('owner_id', c.ownerId)
        .maybeSingle(),
    ])

    const assets: CompanyMediaAsset[] = []

    // 1. 門市照片
    if (storesRes.data) {
      for (const sp of storesRes.data) {
        const storeName = (sp.fin_stores as unknown as { name?: string; code?: string })?.name || '門市'
        const photos = Array.isArray(sp.photos) ? sp.photos : []
        photos.forEach((photoUrl: string, idx: number) => {
          if (typeof photoUrl === 'string' && photoUrl.trim()) {
            assets.push({
              id: `store_${sp.store_id}_${idx}`,
              url: photoUrl,
              name: `${storeName} 照片 ${idx + 1}`,
              category: 'store',
              subGroup: storeName,
            })
          }
        })
      }
    }

    // 2. 產品照片
    if (productsRes.data) {
      for (const prod of productsRes.data) {
        const prodName = prod.name || '產品'
        const images = Array.isArray(prod.images) ? prod.images : []
        images.forEach((imgUrl: string, idx: number) => {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            assets.push({
              id: `prod_${prod.id}_${idx}`,
              url: imgUrl,
              name: `${prodName} ${idx + 1}`,
              category: 'product',
              subGroup: prodName,
            })
          }
        })
      }
    }

    // 3. 品牌素材檔案 (Logo, images)
    if (brandRes.data) {
      if (brandRes.data.logo_url && typeof brandRes.data.logo_url === 'string') {
        assets.push({
          id: 'brand_logo',
          url: brandRes.data.logo_url,
          name: '品牌 Logo',
          category: 'brand',
          subGroup: 'Logo',
        })
      }
      const files = Array.isArray(brandRes.data.files) ? brandRes.data.files : []
      files.forEach((f: { url?: string; name?: string; category?: string }, idx: number) => {
        if (f.url && (f.category === 'image' || f.category === 'logo' || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.url))) {
          assets.push({
            id: `brand_file_${idx}`,
            url: f.url,
            name: f.name || `品牌素材 ${idx + 1}`,
            category: 'brand',
            subGroup: f.category === 'logo' ? 'Logo' : '品牌素材',
          })
        }
      })
    }

    return NextResponse.json({ assets })
  } catch (err) {
    console.error('Error fetching company assets:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
