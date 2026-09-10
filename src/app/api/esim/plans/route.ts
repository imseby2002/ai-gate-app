import { NextRequest, NextResponse } from 'next/server'
import { microEsimClient } from '@/lib/esim/microesim'
import {
  parseMicroEsimPlan,
  DESTINATIONS,
  getDestinationMeta,
  DestinationMeta,
  ParsedEsimPlan,
  DEFAULT_PRICING_SETTINGS,
  EsimPricingSettings,
} from '@/lib/esim/catalog'
import { getEsimSettings } from '@/lib/esim/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country')?.toUpperCase()
    const search = searchParams.get('search')?.toLowerCase()
    const popularOnly = searchParams.get('popular') === 'true'
    const forceRefresh = searchParams.get('refresh') === '1'

    // 0. 讀取管理後台設定的利潤倍率與促銷設定
    const pricingSettings = await getEsimSettings<EsimPricingSettings>('pricing_settings', DEFAULT_PRICING_SETTINGS)

    // 1. 取得所有原生方案（帶快取）
    const rawPlans = await microEsimClient.getDataplanList(forceRefresh)

    // 2. 解析並美化定價與限制分析
    const parsedPlans = rawPlans
      .filter(p => p.status === '1') // 只選啟用的方案
      .map(p => parseMicroEsimPlan(p, pricingSettings))

    // 3. 彙總目的地清單與最低起價
    const destinationMap = new Map<string, { meta: DestinationMeta; planCount: number; minPriceTwd: number }>()

    // 先填入所有定義好的常用目的地
    Object.values(DESTINATIONS).forEach(meta => {
      destinationMap.set(meta.code, { meta, planCount: 0, minPriceTwd: 999999 })
    })

    parsedPlans.forEach(plan => {
      const code = plan.primaryCountryCode
      let dest = destinationMap.get(code)
      if (!dest) {
        const meta = getDestinationMeta(code)
        dest = { meta, planCount: 0, minPriceTwd: 999999 }
        destinationMap.set(code, dest)
      }
      dest.planCount += 1
      if (plan.retailPriceTwd < dest.minPriceTwd) {
        dest.minPriceTwd = plan.retailPriceTwd
      }
    })

    // 整理目的地陣列
    let destinations = Array.from(destinationMap.values())
      .filter(d => d.planCount > 0)
      .map(d => ({
        ...d.meta,
        planCount: d.planCount,
        minPriceTwd: d.minPriceTwd === 999999 ? 129 : d.minPriceTwd,
      }))
      .sort((a, b) => {
        // 熱門排名優先，次依方案數量排序
        if (a.popularRank && b.popularRank) return a.popularRank - b.popularRank
        if (a.popularRank) return -1
        if (b.popularRank) return 1
        return b.planCount - a.planCount
      })

    if (popularOnly) {
      destinations = destinations.filter(d => d.popular)
    }

    if (search) {
      destinations = destinations.filter(d => 
        d.name.toLowerCase().includes(search) ||
        d.nameEn.toLowerCase().includes(search) ||
        d.code.toLowerCase().includes(search)
      )
    }

    // 4. 篩選欲返回的方案列表
    let plansToReturn: ParsedEsimPlan[] = []

    if (country) {
      plansToReturn = parsedPlans.filter(p => {
        const codes = (p.code || '').split(',').map(c => c.trim().toUpperCase())
        return codes.includes(country) || p.primaryCountryCode === country
      })
    } else if (search) {
      plansToReturn = parsedPlans.filter(p => 
        p.channel_dataplan_name.toLowerCase().includes(search) ||
        p.primaryCountryName.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search)
      ).slice(0, 80)
    } else {
      // 預設回傳熱門日本、韓國、泰國精選
      plansToReturn = parsedPlans
        .filter(p => ['JP', 'KR', 'TH', 'VN', 'US', 'EU'].includes(p.primaryCountryCode))
        .slice(0, 100)
    }

    // 依天數與價格排序
    plansToReturn.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day
      return a.retailPriceTwd - b.retailPriceTwd
    })

    return NextResponse.json({
      success: true,
      totalPlans: parsedPlans.length,
      destinations,
      plans: plansToReturn,
      pricingSettings: {
        promo_active: pricingSettings.promo_active,
        promo_title: pricingSettings.promo_title,
        promo_discount: pricingSettings.promo_discount,
      },
      currency: 'TWD',
      refreshedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[API esim/plans] Error:', err)
    return NextResponse.json(
      { success: false, error: err.message || '無法載入 eSIM 方案清單' },
      { status: 500 }
    )
  }
}
