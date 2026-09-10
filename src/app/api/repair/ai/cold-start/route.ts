import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { inferColdStartEquipment } from '@/lib/repair-ai/engine'
import type { EquipmentCategory, EquipmentModelInfo } from '@/lib/types/repair-ai'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUnitContextAny(['repair']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    const body = await req.json().catch(() => ({}))
    const {
      brand,
      model_name,
      category = 'bar',
    } = body as {
      brand: string
      model_name: string
      category: EquipmentCategory
    }

    if (!brand || !model_name) {
      return NextResponse.json({ error: '設備品牌與型號為必填' }, { status: 400 })
    }

    // 依據機電狀態機通用推導邏輯生成
    const generatedModel = inferColdStartEquipment({ brand, model_name, category })

    if (supabase) {
      try {
        await supabase.from('repair_cold_start_models').insert({
          id: generatedModel.id,
          brand: generatedModel.brand,
          model_name: generatedModel.model_name,
          category: generatedModel.category,
          description: generatedModel.description,
          state_machine_steps: generatedModel.state_machine_steps,
          common_error_codes: generatedModel.common_error_codes,
          standard_parts: generatedModel.standard_parts,
        })
      } catch (err) {
        console.warn('DB insert cold start model fallback:', err)
      }
    }

    return NextResponse.json({
      success: true,
      model: generatedModel,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Cold start inference failed' }, { status: 500 })
  }
}
