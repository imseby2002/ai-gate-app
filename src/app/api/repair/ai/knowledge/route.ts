import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { INITIAL_KNOWLEDGE_CHUNKS, INITIAL_EQUIPMENT_MODELS } from '@/lib/repair-ai/knowledge-base'
import type { RepairKnowledgeChunk, KnowledgeChunkType, EquipmentCategory } from '@/lib/types/repair-ai'

// 記憶體中暫存（當 DB 尚未完成遷移時仍可使用）
let memoryChunks: RepairKnowledgeChunk[] = [...INITIAL_KNOWLEDGE_CHUNKS]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const model = searchParams.get('model')
    const category = searchParams.get('category')
    const chunk_type = searchParams.get('type')
    const q = (searchParams.get('q') || '').toLowerCase().trim()
    const safe_for_store = searchParams.get('safe_for_store')

    const ctx = await getUnitContextAny(['repair', 'store']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let chunks: RepairKnowledgeChunk[] = memoryChunks

    if (supabase) {
      try {
        let query = supabase.from('repair_knowledge_chunks').select('*')
        if (model) query = query.eq('equipment_model', model)
        if (category) query = query.eq('category', category)
        if (chunk_type) query = query.eq('chunk_type', chunk_type)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (!error && data && data.length > 0) {
          // 合併 DB 與預載資料
          const dbIds = new Set(data.map((d: any) => d.id))
          chunks = [...data, ...memoryChunks.filter(c => !dbIds.has(c.id))]
        }
      } catch (err) {
        // Fallback to memoryChunks
      }
    }

    if (model) {
      chunks = chunks.filter(c => c.equipment_model.toLowerCase().includes(model.toLowerCase()))
    }
    if (category) {
      chunks = chunks.filter(c => c.category === category)
    }
    if (chunk_type) {
      chunks = chunks.filter(c => c.chunk_type === chunk_type)
    }
    if (safe_for_store === 'true') {
      chunks = chunks.filter(c => c.safe_for_store)
    }
    if (q) {
      chunks = chunks.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    return NextResponse.json({
      success: true,
      count: chunks.length,
      chunks,
      models: INITIAL_EQUIPMENT_MODELS,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch knowledge chunks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUnitContextAny(['repair']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    const body = await req.json().catch(() => ({}))
    const {
      equipment_model,
      category = 'bar',
      chunk_type = 'maintenance_sop',
      title,
      content,
      source_file = '手動輸入/現場紀錄',
      safe_for_store = true,
      tech_only = false,
      tags = [],
    } = body as {
      equipment_model: string
      category: EquipmentCategory
      chunk_type: KnowledgeChunkType
      title: string
      content: string
      source_file?: string
      safe_for_store?: boolean
      tech_only?: boolean
      tags?: string[]
    }

    if (!equipment_model || !title || !content) {
      return NextResponse.json({ error: '機型、標題與內容皆為必填' }, { status: 400 })
    }

    const newChunk: RepairKnowledgeChunk = {
      id: `chk-custom-${Date.now()}`,
      equipment_model,
      category,
      chunk_type,
      title,
      content,
      source_file,
      safe_for_store: Boolean(safe_for_store),
      tech_only: Boolean(tech_only),
      tags: Array.isArray(tags) && tags.length > 0 ? tags : [equipment_model, chunk_type],
      created_at: new Date().toISOString(),
    }

    memoryChunks.unshift(newChunk)

    if (supabase) {
      try {
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
        console.warn('DB insert chunk fallback to memory:', err)
      }
    }

    return NextResponse.json({
      success: true,
      chunk: newChunk,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create chunk' }, { status: 500 })
  }
}
