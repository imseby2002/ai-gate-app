import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }
const dateOr = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) }
const REASONS = new Set(['expired', 'damaged', 'other'])

// 某門市的耗損紀錄。?store= 必填，可選 &from=&to=（loss_date 區間）
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const sp = new URL(req.url).searchParams
  const store = s(sp.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  let q = supabase.from('inv_losses')
    .select('id, material_code, material_name, unit, qty, reason, loss_date, batch_id, note')
    .eq('owner_id', user.id).eq('store', store)
  const from = s(sp.get('from')); const to = s(sp.get('to'))
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte('loss_date', from)
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte('loss_date', to)
  const { data, error } = await q.order('loss_date', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// 獨立填報耗損（未走批次報廢）。body: { store, material_code, material_name?, unit?, qty, reason?, loss_date?, note? }
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  const material_code = s(b.material_code)
  if (!store || !material_code) return NextResponse.json({ error: 'store 與 material_code 必填' }, { status: 400 })
  const { data, error } = await supabase.from('inv_losses').insert({
    owner_id: user.id, store, material_code,
    material_name: s(b.material_name), unit: s(b.unit), qty: num(b.qty),
    reason: REASONS.has(s(b.reason)) ? s(b.reason) : 'other',
    loss_date: dateOr(b.loss_date), note: s(b.note),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 刪除耗損紀錄（輸入錯誤時用）。body: { id }
export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('inv_losses').delete().eq('id', s(id)).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
