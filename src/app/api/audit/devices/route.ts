import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  const c = await getUnitContextAny(['audit', 'store', 'mkt'])
  return c.ok ? c : null
}

// 門市公務機管理 API
export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const store = searchParams.get('store')?.trim()

  let q = c.admin.from('audit_official_devices')
    .select('*')
    .eq('owner_id', c.ownerId)
    .order('store')

  if (store) q = q.eq('store', store)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ devices: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store) return NextResponse.json({ error: '門市代碼必填' }, { status: 400 })

  const id = b.id ? String(b.id) : undefined
  const payload = {
    owner_id: c.ownerId,
    store,
    device_name: String(b.device_name ?? '門市公務機').trim(),
    serial_number: String(b.serial_number ?? '').trim(),
    zalo_account: String(b.zalo_account ?? '').trim(),
    official_bank_qr: String(b.official_bank_qr ?? '').trim(),
    status: String(b.status ?? 'active').trim(),
    last_inspected_at: b.inspected ? new Date().toISOString() : b.last_inspected_at,
    last_inspector: String(b.last_inspector ?? '').trim(),
    notes: String(b.notes ?? '').trim(),
    updated_at: new Date().toISOString(),
  }

  if (id) {
    const { error } = await c.admin.from('audit_official_devices').update(payload).eq('id', id).eq('owner_id', c.ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id })
  } else {
    const { data, error } = await c.admin.from('audit_official_devices').insert(payload).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('audit_official_devices').delete().eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
