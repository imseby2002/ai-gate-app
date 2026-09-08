// Feeling Tea AI R&D Lab 綜合數據 API
// 串接原料庫、結構化配方與版本、實驗管理、感官評估、添加物與競品資料
import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, ownerId: '' }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, ownerId: ctx.ownerId }
}

// GET /api/rd/lab?section=all
export async function GET(req: NextRequest) {
  const { user, supabase, ownerId } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const section = searchParams.get('section') || 'all'

  try {
    const [
      ingredientsRes,
      recipesRes,
      experimentsRes,
      sensoryRes,
      additivesRes,
      competitorsRes,
      knowledgeRes,
      expertsRes,
    ] = await Promise.all([
      // 1. 原料庫 (Ingredient Cards)
      supabase.from('rd_ingredients')
        .select('*')
        .eq('owner_id', ownerId)
        .order('category')
        .order('name'),
      // 2. 結構化配方 (含版本號)
      supabase.from('rd_recipes_v2')
        .select('*, rd_recipe_ingredients(*)')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false }),
      // 3. 實驗紀錄 (Experiments)
      supabase.from('rd_experiments')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false }),
      // 4. 感官評估 (Sensory Evaluations)
      supabase.from('rd_sensory_evaluations')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false }),
      // 5. 食品添加物與法規參考 (Food Additives)
      supabase.from('rd_food_additives')
        .select('*')
        .order('ins_number'),
      // 6. 競品情資 (Competitor DB)
      supabase.from('rd_competitor_products')
        .select('*')
        .eq('owner_id', ownerId)
        .order('brand_name'),
      // 7. 外部研發知識 (External Knowledge)
      supabase.from('rd_external_knowledge')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false }),
      // 8. 專家庫 (Expert Library)
      supabase.from('rd_expert_profiles')
        .select('*')
        .eq('owner_id', ownerId)
        .order('name'),
    ])

    return NextResponse.json({
      ingredients: ingredientsRes.data ?? [],
      recipes: recipesRes.data ?? [],
      experiments: experimentsRes.data ?? [],
      sensoryEvaluations: sensoryRes.data ?? [],
      additives: additivesRes.data ?? [],
      competitors: competitorsRes.data ?? [],
      externalKnowledge: knowledgeRes.data ?? [],
      experts: expertsRes.data ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/rd/lab (儲存或建立各類實體)
export async function POST(req: NextRequest) {
  const { user, supabase, ownerId } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { target, data } = body as { target: string; data: any }

  if (!target || !data) {
    return NextResponse.json({ error: 'target and data required' }, { status: 400 })
  }

  try {
    // 1. 新增或更新原料 (Ingredient Card)
    if (target === 'ingredient') {
      const payload = {
        ...data,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }
      if (data.id) {
        const { data: updated, error } = await supabase
          .from('rd_ingredients')
          .update(payload)
          .eq('id', data.id)
          .eq('owner_id', ownerId)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, item: updated })
      } else {
        const { data: created, error } = await supabase
          .from('rd_ingredients')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, item: created })
      }
    }

    // 2. 建立或更新結構化配方 (含配方成分)
    if (target === 'recipe') {
      const { items, ...recipeFields } = data
      const payload = {
        ...recipeFields,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }

      let recipeId = data.id
      if (recipeId) {
        const { error } = await supabase
          .from('rd_recipes_v2')
          .update(payload)
          .eq('id', recipeId)
          .eq('owner_id', ownerId)
        if (error) throw error
      } else {
        const { data: created, error } = await supabase
          .from('rd_recipes_v2')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        recipeId = created.id
      }

      // 替換配方原料清單
      if (items && Array.isArray(items)) {
        await supabase.from('rd_recipe_ingredients').delete().eq('recipe_id', recipeId)
        const itemRows = items.map((it: any, idx: number) => ({
          recipe_id: recipeId,
          ingredient_id: it.ingredient_id || null,
          name: it.name,
          category: it.category || 'other',
          qty_g: Number(it.qty_g) || 0,
          ratio_pct: Number(it.ratio_pct) || 0,
          cost_per_unit: Number(it.cost_per_unit) || 0,
          cost_amount: Number(it.cost_amount) || 0,
          brix: Number(it.brix) || 0,
          sugar_g: Number(it.sugar_g) || 0,
          sort_order: idx,
        }))
        if (itemRows.length > 0) {
          await supabase.from('rd_recipe_ingredients').insert(itemRows)
        }
      }

      return NextResponse.json({ ok: true, recipe_id: recipeId })
    }

    // 3. 實驗紀錄 (Experiment)
    if (target === 'experiment') {
      const payload = {
        ...data,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }
      if (data.id) {
        const { data: updated, error } = await supabase
          .from('rd_experiments')
          .update(payload)
          .eq('id', data.id)
          .eq('owner_id', ownerId)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, item: updated })
      } else {
        const { data: created, error } = await supabase
          .from('rd_experiments')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, item: created })
      }
    }

    // 4. 感官評分 (Sensory Evaluation)
    if (target === 'sensory') {
      const payload = {
        ...data,
        owner_id: ownerId,
        created_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('rd_sensory_evaluations')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, item: created })
    }

    // 5. 競品資料 (Competitor)
    if (target === 'competitor') {
      const payload = {
        ...data,
        owner_id: ownerId,
        created_at: new Date().toISOString(),
      }
      const { data: created, error } = await supabase
        .from('rd_competitor_products')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, item: created })
    }

    return NextResponse.json({ error: `Unknown target: ${target}` }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
