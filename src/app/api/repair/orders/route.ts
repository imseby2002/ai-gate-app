import { getUnitContext, getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const PRIORITY = ['low', 'normal', 'high', 'urgent']
const STATUS = ['reported', 'assigned', 'in_progress', 'done', 'cancelled']

// 報修（門市）與維修（管理）皆可讀取；門市可建立
async function readCtx() { const c = await getUnitContextAny(['repair', 'store']); return c.ok ? c : null }
async function manageCtx() { const c = await getUnitContext('repair'); return c.ok ? c : null }

// 工單清單。?store= ?status= 篩選
export async function GET(req: NextRequest) {
  const c = await readCtx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = s(sp.get('store'))
  const status = s(sp.get('status'))
  let q = c.admin.from('repair_orders')
    .select('id, store, equipment_id, equipment_name, title, description, priority, status, reporter_name, assignee_type, assignee_id, assignee_name, cost, resolution, reported_at, assigned_at, completed_at')
    .eq('owner_id', c.ownerId)
  if (store) q = q.eq('store', store)
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('reported_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// 建立報修單（門市或維修單位）
export async function POST(req: NextRequest) {
  const c = await readCtx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const title = s(b.title)
  if (!title) return NextResponse.json({ error: '問題標題必填' }, { status: 400 })

  // 報修人名稱
  const { data: prof } = await c.admin.from('profiles').select('full_name').eq('id', c.userId).maybeSingle()

  // 若帶 equipment_id，取設備名稱快照
  let equipmentName = s(b.equipment_name)
  const equipmentId = s(b.equipment_id) || null
  if (equipmentId) {
    const { data: eq } = await c.admin.from('repair_equipment').select('name').eq('id', equipmentId).eq('owner_id', c.ownerId).maybeSingle()
    if (eq?.name) equipmentName = eq.name
  }

  const { data, error } = await c.admin.from('repair_orders').insert({
    owner_id: c.ownerId,
    store: s(b.store),
    equipment_id: equipmentId,
    equipment_name: equipmentName,
    title,
    description: s(b.description),
    priority: PRIORITY.includes(s(b.priority)) ? s(b.priority) : 'normal',
    status: 'reported',
    reported_by: c.userId,
    reporter_name: s(prof?.full_name),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 派工／更新狀態／記錄費用（限維修單位）
export async function PATCH(req: NextRequest) {
  const c = await manageCtx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const now = new Date().toISOString()

  if (b.title !== undefined) { if (!s(b.title)) return NextResponse.json({ error: '問題標題必填' }, { status: 400 }); upd.title = s(b.title) }
  if (b.description !== undefined) upd.description = s(b.description)
  if (b.store !== undefined) upd.store = s(b.store)
  if (b.priority !== undefined && PRIORITY.includes(s(b.priority))) upd.priority = s(b.priority)
  if (b.cost !== undefined) upd.cost = num(b.cost)
  if (b.resolution !== undefined) upd.resolution = s(b.resolution)

  // 派工：assignee_type + assignee_id (+ 快照名稱)
  if (b.assignee_type !== undefined || b.assignee_id !== undefined) {
    const atype = s(b.assignee_type)
    const aid = s(b.assignee_id)
    if (atype && aid && (atype === 'vendor' || atype === 'employee')) {
      const table = atype === 'vendor' ? 'fin_vendors' : 'hr_employees'
      const { data: row } = await c.admin.from(table).select('name').eq('id', aid).eq('owner_id', c.ownerId).maybeSingle()
      upd.assignee_type = atype
      upd.assignee_id = aid
      upd.assignee_name = s(row?.name)
      upd.assigned_at = now
    } else {
      // 清除派工
      upd.assignee_type = ''
      upd.assignee_id = ''
      upd.assignee_name = ''
    }
  }

  // 狀態轉移
  if (b.status !== undefined && STATUS.includes(s(b.status))) {
    const st = s(b.status)
    upd.status = st
    if (st === 'done') upd.completed_at = now
    if (st === 'assigned' && !upd.assigned_at) upd.assigned_at = now
    if (st === 'reported') { upd.assigned_at = null; upd.completed_at = null }
  }

  const { error } = await c.admin.from('repair_orders').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await manageCtx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('repair_orders').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
