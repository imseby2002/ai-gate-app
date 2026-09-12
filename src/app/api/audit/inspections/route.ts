import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  const c = await getUnitContextAny(['audit', 'store'])
  return c.ok ? c : null
}

// 現場巡檢紀錄清單或單筆明細
export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')?.trim()
  const store = searchParams.get('store')?.trim()

  if (id) {
    const { data: inspection } = await c.admin.from('audit_inspections')
      .select('*').eq('id', id).eq('owner_id', c.ownerId).single()
    if (!inspection) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: items } = await c.admin.from('audit_inspection_items')
      .select('*').eq('inspection_id', id).eq('owner_id', c.ownerId).order('created_at')

    return NextResponse.json({ inspection, items: items ?? [] })
  }

  let q = c.admin.from('audit_inspections')
    .select('*')
    .eq('owner_id', c.ownerId)
    .order('inspection_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (store) q = q.eq('store', store)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inspections: data ?? [] })
}

// 建立或更新現場巡檢紀錄（主表 + 項目）
export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store) return NextResponse.json({ error: '門市必填' }, { status: 400 })

  const id = b.id ? String(b.id) : undefined
  const inspectionPayload = {
    owner_id: c.ownerId,
    store,
    auditor_name: String(b.auditor_name ?? '').trim(),
    status: String(b.status ?? 'in_progress'),
    overall_score: Number(b.overall_score) || 100,
    inspection_date: b.inspection_date || new Date().toISOString().slice(0, 10),
    summary: String(b.summary ?? '').trim(),
    updated_at: new Date().toISOString(),
  }

  let inspectionId = id
  if (id) {
    const { error } = await c.admin.from('audit_inspections').update(inspectionPayload).eq('id', id).eq('owner_id', c.ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data, error } = await c.admin.from('audit_inspections').insert(inspectionPayload).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inspectionId = data.id
  }

  // 儲存或批次更新細項
  if (Array.isArray(b.items) && inspectionId) {
    // 刪除既有項目並覆蓋
    await c.admin.from('audit_inspection_items').delete().eq('inspection_id', inspectionId).eq('owner_id', c.ownerId)
    const itemRecords = b.items.map((it: any) => ({
      inspection_id: inspectionId,
      owner_id: c.ownerId,
      category: String(it.category ?? 'hygiene'),
      item_title: String(it.item_title ?? '').trim(),
      score: Number(it.score) ?? 10,
      photos: Array.isArray(it.photos) ? it.photos : [],
      handwritten_notes: String(it.handwritten_notes ?? '').trim(),
      ai_analysis: String(it.ai_analysis ?? '').trim(),
      objective_metrics: it.objective_metrics || {},
      penalty_flag: !!it.penalty_flag,
      penalty_reason: String(it.penalty_reason ?? '').trim(),
    }))
    if (itemRecords.length > 0) {
      const { error: itemErr } = await c.admin.from('audit_inspection_items').insert(itemRecords)
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, id: inspectionId })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('audit_inspections').delete().eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
