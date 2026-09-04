import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }
const dateOr = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : new Date().toISOString().slice(0, 10) }

// 某廠商採購紀錄 ＋ 總表（總額／筆數）
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const vendorId = s(new URL(req.url).searchParams.get('vendor_id'))
  if (!vendorId) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
  const { data } = await supabase.from('fin_vendor_purchases')
    .select('id, purchased_on, product, qty, amount, note')
    .eq('owner_id', user.id).eq('vendor_id', vendorId).order('purchased_on', { ascending: false }).limit(200)
  const rows = data ?? []
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  return NextResponse.json({ purchases: rows, total, count: rows.length })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const vendorId = s(b.vendor_id)
  if (!vendorId) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
  const { data, error } = await supabase.from('fin_vendor_purchases').insert({
    owner_id: user.id, vendor_id: vendorId, purchased_on: dateOr(b.purchased_on),
    product: s(b.product), qty: num(b.qty), amount: num(b.amount), note: s(b.note),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_vendor_purchases').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
