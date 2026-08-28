import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

// 某門市的安全庫存表（安全量／滿倉量）
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = s(new URL(req.url).searchParams.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const { data } = await supabase.from('inv_safety_stock')
    .select('material_code, material_name, unit, safety_qty, full_qty').eq('owner_id', user.id).eq('store', store)
  return NextResponse.json({ rows: data ?? [] })
}

// 批次 upsert。body: { store, rows:[{material_code, material_name, unit, safety_qty, full_qty}] }
export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const rows = (Array.isArray(b.rows) ? b.rows : [])
    .map((r: Record<string, unknown>) => ({
      owner_id: user.id, store, material_code: s(r.material_code), material_name: s(r.material_name),
      unit: s(r.unit), safety_qty: num(r.safety_qty), full_qty: num(r.full_qty), updated_at: new Date().toISOString(),
    }))
    .filter((r: { material_code: string }) => r.material_code)
  if (rows.length === 0) return NextResponse.json({ ok: true, saved: 0 })
  const { error } = await supabase.from('inv_safety_stock').upsert(rows, { onConflict: 'owner_id,store,material_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, saved: rows.length })
}
