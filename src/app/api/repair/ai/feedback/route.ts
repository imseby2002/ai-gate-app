import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { INITIAL_REPAIR_CASES } from '@/lib/repair-ai/knowledge-base'
import type { RepairCaseFeedback, RepairKnowledgeChunk } from '@/lib/types/repair-ai'

let memoryCases: RepairCaseFeedback[] = [...INITIAL_REPAIR_CASES]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const model = searchParams.get('model')

    const ctx = await getUnitContextAny(['repair']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let cases = memoryCases

    if (supabase) {
      try {
        let query = supabase.from('repair_case_feedbacks').select('*')
        if (model) query = query.eq('equipment_model', model)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (!error && data && data.length > 0) {
          const dbIds = new Set(data.map((d: any) => d.id))
          cases = [...data, ...memoryCases.filter(c => !dbIds.has(c.id))]
        }
      } catch (err) {
        // Fallback
      }
    }

    if (model) {
      cases = cases.filter(c => c.equipment_model.toLowerCase().includes(model.toLowerCase()))
    }

    return NextResponse.json({
      success: true,
      count: cases.length,
      cases,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch cases' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUnitContextAny(['repair']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    const body = await req.json().catch(() => ({}))
    const {
      order_id,
      equipment_model,
      symptom,
      actual_root_cause,
      parts_replaced,
      measured_resistance_or_voltage = '',
      technician_note,
      verified_by = '工務工程師',
    } = body as {
      order_id?: string
      equipment_model: string
      symptom: string
      actual_root_cause: string
      parts_replaced: string
      measured_resistance_or_voltage?: string
      technician_note: string
      verified_by?: string
    }

    if (!equipment_model || !actual_root_cause || !parts_replaced) {
      return NextResponse.json({ error: '機型、真實原因與更換零件為必填' }, { status: 400 })
    }

    const newCase: RepairCaseFeedback = {
      id: `case-${Date.now()}`,
      order_id,
      equipment_model,
      symptom: symptom || '現場回報異常',
      actual_root_cause,
      parts_replaced,
      measured_resistance_or_voltage,
      technician_note: technician_note || '',
      verified_by,
      created_at: new Date().toISOString(),
    }

    memoryCases.unshift(newCase)

    // 同步建立一個 real_case 知識庫切片，讓 AI 知識庫立刻習得本次維修經驗
    const newChunk: RepairKnowledgeChunk = {
      id: `chk-feedback-${Date.now()}`,
      equipment_model,
      category: 'bar',
      chunk_type: 'real_case',
      title: `【技師實戰回饋】${equipment_model} - ${symptom.slice(0, 25)}`,
      content: `【真因分析】：${actual_root_cause}\n【更換料件】：${parts_replaced}\n【實測數值】：${measured_resistance_or_voltage || '未填寫'}\n【技師備忘】：${technician_note}\n【回報技師】：${verified_by}`,
      source_file: order_id ? `報修工單回饋_${order_id}` : '現場技師回填',
      safe_for_store: false,
      tech_only: true,
      tags: [equipment_model, '實戰回饋', '故障真因', parts_replaced],
      created_at: new Date().toISOString(),
    }

    if (supabase) {
      try {
        await supabase.from('repair_case_feedbacks').insert({
          id: newCase.id,
          order_id: newCase.order_id,
          equipment_model: newCase.equipment_model,
          symptom: newCase.symptom,
          actual_root_cause: newCase.actual_root_cause,
          parts_replaced: newCase.parts_replaced,
          measured_resistance_or_voltage: newCase.measured_resistance_or_voltage,
          technician_note: newCase.technician_note,
          verified_by: newCase.verified_by,
        })
        await supabase.from('repair_knowledge_chunks').insert({
          id: newChunk.id,
          equipment_model: newChunk.equipment_model,
          category: newChunk.category,
          chunk_type: newChunk.chunk_type,
          title: newChunk.title,
          content: newChunk.content,
          source_file: newChunk.source_file,
          safe_for_store: newChunk.safe_for_store,
          tech_only: newChunk.tech_only,
          tags: newChunk.tags,
        })
      } catch (err) {
        console.warn('DB feedback insert fallback:', err)
      }
    }

    return NextResponse.json({
      success: true,
      case: newCase,
      chunk: newChunk,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to record feedback' }, { status: 500 })
  }
}
