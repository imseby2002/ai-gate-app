import { NextRequest, NextResponse } from 'next/server'
import { calculateRecipe } from '@/lib/rd/formula-engine'
import { checkLegalCompliance } from '@/lib/rd/legal-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ingredients = [], packagingCostVnd = 1500, targetPriceVnd = 45000 } = body

    // 1. 純演算法計算（總重、總量、加權糖度、每 100ml 糖克數、COGS、毛利率）
    const calc = calculateRecipe(ingredients, {
      packagingCostVnd: Number(packagingCostVnd),
      targetPriceVnd: Number(targetPriceVnd),
    })

    // 2. 越南食品法規與特別消費稅檢查（糖稅 > 5.0g / 100ml 預警）
    const legal = checkLegalCompliance(calc.sugar_per_100ml)

    return NextResponse.json({
      ok: true,
      calculation: calc,
      legalCompliance: legal,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
