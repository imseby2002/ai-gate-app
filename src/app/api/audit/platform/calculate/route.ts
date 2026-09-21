import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import {
  INITIAL_AUDIT_RULES,
  INITIAL_RECIPES_VERSIONED,
  INITIAL_INGREDIENT_PRICING,
  SAMPLE_IPOS_RECORDS,
  SAMPLE_IVT_RECORDS,
  calculateMaterialRationality,
} from '@/lib/audit/platform-core'
import { computeInventoryVariance } from '@/lib/inv/variance-engine'
import type { AuditRule, RDRecipeVersioned, IngredientPricingRecord, MaterialConsumptionRow } from '@/lib/types/audit-platform'

export const maxDuration = 60

async function getAdminUser() {
  const ctx = await getUnitContextAny(['audit', 'store', 'rd'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, storeCode: null as string | null, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, storeCode: ctx.storeCode ?? null, status: ctx.status }
}

// 誤差率分級：±4% 正常、4-8% 輕微偏差、8-15% 高風險、>15% 嚴重損失
function anomalyLevelOf(pct: number | null): MaterialConsumptionRow['anomaly_level'] {
  if (pct === null) return 'normal'
  const abs = Math.abs(pct)
  if (abs > 15) return 'critical'
  if (abs > 8) return 'high_risk'
  if (abs > 4) return 'low_risk'
  return 'normal'
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase, storeCode, status } = await getAdminUser()
    if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

    const { searchParams } = new URL(req.url)
    const store = storeCode || (searchParams.get('store') ?? '').trim()
    const now = new Date()
    const year = parseInt(searchParams.get('year') ?? '') || now.getFullYear()
    const month = parseInt(searchParams.get('month') ?? '') || (now.getMonth() + 1)

    // 真實原物料耗用差異，來自跟 /audit（原物料合理性）頁面共用的引擎——
    // 智慧稽核平台原本用一整套寫死的樣本資料（SAMPLE_IPOS_RECORDS／SAMPLE_IVT_RECORDS），
    // 跟畫面上選的門市／日期完全無關；現在改成真的讀該門市當月的 IPOS 銷量與 IVT 實耗。
    const real = store ? await computeInventoryVariance(supabase, user.id, store, year, month) : null
    const hasRealData = !!real && real.rows.length > 0

    if (hasRealData && real) {
      const rows: MaterialConsumptionRow[] = real.rows.map(r => ({
        material_code: r.material_code,
        material_name: r.material_name,
        unit: r.unit,
        raw_theoretical_qty: Math.round(r.recipe_theo * 100) / 100,
        composition_adjusted_qty: Math.round(r.expected * 100) / 100,
        actual_usage_qty: Math.round(r.actual * 100) / 100,
        diff_qty: Math.round(r.diff * 100) / 100,
        diff_pct: r.pct !== null ? Math.round(r.pct * 10) / 10 : null,
        unit_price: r.price,
        money_loss: Math.round(r.diff > 0 ? r.money_loss : 0),
        anomaly_level: anomalyLevelOf(r.pct),
        possible_causes: [],
        applied_rules: [],
        trend_vs_history: '',
        store_vs_peers: '',
      }))
      const totalRawLoss = Math.round(rows.reduce((s, r) => s + Math.max(0, (r.actual_usage_qty - r.raw_theoretical_qty) * r.unit_price), 0))

      return NextResponse.json({
        success: true,
        store,
        year,
        month,
        isSampleData: false,
        rows,
        totalRawLoss,
        totalAdjustedLoss: Math.round(real.total_loss),
        unmappedProducts: real.unmapped.map(u => `${u.product_name} (${u.product_code})`),
        rulesAppliedCount: 0,
        appliedRulesSummary: [],
      })
    }

    // 該門市／月份尚無真實 IPOS／IVT 資料——回傳樣本資料並明確標示，避免誤導為真實分析結果
    let rules: AuditRule[] = INITIAL_AUDIT_RULES
    const recipes: RDRecipeVersioned[] = INITIAL_RECIPES_VERSIONED
    const pricing: IngredientPricingRecord[] = INITIAL_INGREDIENT_PRICING

    if (supabase) {
      try {
        const { data: dbRules, error: rErr } = await supabase.from('audit_rules_v2').select('*').order('created_at')
        if (!rErr && dbRules && dbRules.length > 0) rules = dbRules
      } catch (err) {
        console.warn('Fallback to seeded rules:', err)
      }
    }

    const result = calculateMaterialRationality({
      iposRecords: SAMPLE_IPOS_RECORDS,
      ivtRecords: SAMPLE_IVT_RECORDS,
      recipes,
      pricing,
      rules,
      targetDate: `${year}-${String(month).padStart(2, '0')}-01`,
    })

    return NextResponse.json({
      success: true,
      store: store || '（尚未選擇門市）',
      year,
      month,
      isSampleData: true,
      iposRecords: SAMPLE_IPOS_RECORDS,
      ivtRecords: SAMPLE_IVT_RECORDS,
      recipesCount: recipes.length,
      rulesAppliedCount: result.appliedRulesSummary.length,
      ...result,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Calculation engine failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      iposRecords = SAMPLE_IPOS_RECORDS,
      ivtRecords = SAMPLE_IVT_RECORDS,
      targetDate = '2026-09-08',
      customRules,
    } = body

    const rules: AuditRule[] = customRules && customRules.length > 0 ? customRules : INITIAL_AUDIT_RULES

    const result = calculateMaterialRationality({
      iposRecords,
      ivtRecords,
      recipes: INITIAL_RECIPES_VERSIONED,
      pricing: INITIAL_INGREDIENT_PRICING,
      rules,
      targetDate,
    })

    return NextResponse.json({
      success: true,
      targetDate,
      ...result,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to recalculate' }, { status: 500 })
  }
}
