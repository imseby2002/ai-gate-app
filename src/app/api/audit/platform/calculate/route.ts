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
import type { AuditRule, RDRecipeVersioned, IngredientPricingRecord } from '@/lib/types/audit-platform'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const store = searchParams.get('store') || '胡志明一號旗艦店 (HCM-01)'
    const date = searchParams.get('date') || '2026-09-08'

    const ctx = await getUnitContextAny(['audit', 'store', 'rd']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let rules: AuditRule[] = INITIAL_AUDIT_RULES
    let recipes: RDRecipeVersioned[] = INITIAL_RECIPES_VERSIONED
    let pricing: IngredientPricingRecord[] = INITIAL_INGREDIENT_PRICING

    // 若 Supabase 存在則嘗試讀取自訂規則
    if (supabase) {
      try {
        const { data: dbRules, error: rErr } = await supabase.from('audit_rules_v2').select('*').order('created_at')
        if (!rErr && dbRules && dbRules.length > 0) {
          rules = dbRules
        }
      } catch (err) {
        console.warn('Fallback to seeded rules:', err)
      }
    }

    // 執行原料消耗推算引擎
    const result = calculateMaterialRationality({
      iposRecords: SAMPLE_IPOS_RECORDS,
      ivtRecords: SAMPLE_IVT_RECORDS,
      recipes,
      pricing,
      rules,
      targetDate: date,
    })

    return NextResponse.json({
      success: true,
      store,
      date,
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
