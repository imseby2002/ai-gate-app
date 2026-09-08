// 確定性配方計算引擎 (Deterministic Formula Calculation Engine)
// 由純數學演算法精確計算，保證數據客觀一致，拒絕 LLM 數學瞎猜。

export interface RecipeIngredientInput {
  name: string
  category: 'tea' | 'milk' | 'sugar' | 'foam' | 'syrup' | 'juice' | 'topping' | 'ice' | 'water' | 'package' | 'other'
  qty_g: number
  cost_per_kg?: number // VND / kg
  brix?: number // 糖度 °Brix (例: 果糖糖漿 75, 砂糖 100, 牛奶 4.8, 純茶 0.2)
  density?: number // 密度 g/ml (預設依分類估算)
}

export interface CalculationResult {
  total_weight_g: number
  total_volume_ml: number
  total_sugar_g: number
  sugar_per_100ml: number // g / 100ml (用於法規檢查)
  estimated_brix: number // 成品加權 °Brix
  tea_ratio_pct: number // 茶底比例
  milk_ratio_pct: number // 乳品比例
  ingredient_cogs: number // 原料總成本 VND
  packaging_cogs: number // 包材總成本 VND (杯+膜+吸管+提袋)
  total_cogs: number // 每杯 COGS VND
  target_price: number // 門市售價
  gross_profit: number // 毛利額 VND
  gross_margin_pct: number // 毛利率 %
  breakdown: Array<{
    name: string
    category: string
    qty_g: number
    weight_pct: number
    cost: number
    sugar_g: number
  }>
}

const DEFAULT_DENSITY: Record<string, number> = {
  tea: 1.0,
  water: 1.0,
  milk: 1.03,
  foam: 0.6,
  sugar: 1.35,
  syrup: 1.3,
  juice: 1.08,
  topping: 1.15,
  ice: 0.92,
  package: 1.0,
  other: 1.0,
}

// 預設常見品類糖度估算 (若使用者未單獨填寫 brix)
const DEFAULT_BRIX: Record<string, number> = {
  tea: 0.2,
  water: 0.0,
  milk: 4.8, // 牛奶含乳糖約 4.8%
  foam: 15.0,
  sugar: 100.0,
  syrup: 70.0, // 一般高果糖漿約 70~75 °Brix
  juice: 12.0,
  topping: 20.0,
  ice: 0.0,
  package: 0.0,
  other: 0.0,
}

export function calculateRecipe(
  ingredients: RecipeIngredientInput[],
  options: {
    packagingCostVnd?: number
    targetPriceVnd?: number
  } = {}
): CalculationResult {
  const packagingCost = options.packagingCostVnd ?? 1500 // 杯+蓋/膜+吸管+提袋預設 1,500 VND
  const targetPrice = options.targetPriceVnd ?? 45000 // 預設 45,000 VND

  let totalWeightG = 0
  let totalVolumeMl = 0
  let totalSugarG = 0
  let ingredientCogs = 0
  let teaWeightG = 0
  let milkWeightG = 0

  // 1. 初步累加
  for (const item of ingredients) {
    if (item.category === 'package') continue // 包材不計入重量與體積

    const qty = Number(item.qty_g) || 0
    const density = item.density || DEFAULT_DENSITY[item.category] || 1.0
    const brix = item.brix !== undefined ? item.brix : (DEFAULT_BRIX[item.category] || 0)
    const costPerKg = Number(item.cost_per_kg) || 0

    totalWeightG += qty
    totalVolumeMl += qty / density

    const sugarContribution = qty * (brix / 100)
    totalSugarG += sugarContribution

    const itemCost = (qty / 1000) * costPerKg
    ingredientCogs += itemCost

    if (item.category === 'tea') teaWeightG += qty
    if (item.category === 'milk' || item.category === 'foam') milkWeightG += qty
  }

  // 避免除以 0
  const safeVolume = Math.max(1, totalVolumeMl)
  const safeWeight = Math.max(1, totalWeightG)

  const sugarPer100ml = (totalSugarG / safeVolume) * 100
  const estimatedBrix = (totalSugarG / safeWeight) * 100
  const teaRatioPct = (teaWeightG / safeWeight) * 100
  const milkRatioPct = (milkWeightG / safeWeight) * 100

  const totalCogs = ingredientCogs + packagingCost
  const grossProfit = targetPrice - totalCogs
  const grossMarginPct = targetPrice > 0 ? (grossProfit / targetPrice) * 100 : 0

  // 項目明細比例
  const breakdown = ingredients.map(item => {
    const qty = Number(item.qty_g) || 0
    const brix = item.brix !== undefined ? item.brix : (DEFAULT_BRIX[item.category] || 0)
    const costPerKg = Number(item.cost_per_kg) || 0
    const cost = item.category === 'package' ? packagingCost : (qty / 1000) * costPerKg
    const sugar_g = item.category === 'package' ? 0 : qty * (brix / 100)
    return {
      name: item.name,
      category: item.category,
      qty_g: qty,
      weight_pct: safeWeight > 0 ? (qty / safeWeight) * 100 : 0,
      cost: Math.round(cost),
      sugar_g: Math.round(sugar_g * 10) / 10,
    }
  })

  return {
    total_weight_g: Math.round(totalWeightG * 10) / 10,
    total_volume_ml: Math.round(totalVolumeMl),
    total_sugar_g: Math.round(totalSugarG * 10) / 10,
    sugar_per_100ml: Math.round(sugarPer100ml * 10) / 10,
    estimated_brix: Math.round(estimatedBrix * 10) / 10,
    tea_ratio_pct: Math.round(teaRatioPct * 10) / 10,
    milk_ratio_pct: Math.round(milkRatioPct * 10) / 10,
    ingredient_cogs: Math.round(ingredientCogs),
    packaging_cogs: Math.round(packagingCost),
    total_cogs: Math.round(totalCogs),
    target_price: Math.round(targetPrice),
    gross_profit: Math.round(grossProfit),
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    breakdown,
  }
}
