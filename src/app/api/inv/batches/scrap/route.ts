import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const REASONS = new Set(['expired', 'damaged', 'other'])

// 報廢一個批次：批次改為 scrapped（不再觸發到期通知），並自動放入耗損（扣庫存）。
// body: { id, reason?（預設 expired）, note? }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const reason = REASONS.has(s(b.reason)) ? s(b.reason) : 'expired'

  const { data: batch } = await supabase.from('inv_material_batches')
    .select('store, material_code, material_name, unit, qty, status')
    .eq('id', id).eq('owner_id', user.id).single()
  if (!batch) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (batch.status === 'scrapped') return NextResponse.json({ error: '此批次已報廢' }, { status: 409 })

  const now = new Date().toISOString()
  const { error: upErr } = await supabase.from('inv_material_batches')
    .update({ status: 'scrapped', scrapped_at: now, updated_at: now })
    .eq('id', id).eq('owner_id', user.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // 自動放入耗損（扣庫存＝該批次數量離開 active）
  const { error: lossErr } = await supabase.from('inv_losses').insert({
    owner_id: user.id, store: batch.store, material_code: batch.material_code,
    material_name: batch.material_name, unit: batch.unit, qty: batch.qty,
    reason, loss_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
    batch_id: id, note: s(b.note),
  })
  if (lossErr) return NextResponse.json({ error: lossErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
