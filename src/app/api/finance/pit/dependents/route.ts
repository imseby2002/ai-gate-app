import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'

// 扶養人（Người phụ thuộc）CRUD
const deny = (status: number) => NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
const FIELDS = ['name', 'relationship', 'id_number', 'tax_code', 'birthday', 'from_month', 'to_month', 'registered', 'note'] as const

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) {
    if (!(k in body)) continue
    const v = body[k]
    if (k === 'registered') out[k] = !!v
    else if (k === 'birthday') out[k] = v ? String(v) : null
    else out[k] = String(v ?? '').trim()
  }
  return out
}

export async function POST(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const body = await req.json().catch(() => ({}))
  const employee_id = String(body.employee_id ?? '')
  const data = pick(body)
  if (!employee_id || !data.name) return NextResponse.json({ error: 'employee_id, name required' }, { status: 400 })

  const { data: emp, error: eErr } = await ctx.admin.from('hr_employees').select('id').eq('id', employee_id).eq('owner_id', ctx.ownerId).maybeSingle()
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  if (!emp) return NextResponse.json({ error: 'employee not found' }, { status: 404 })

  const { data: row, error } = await ctx.admin.from('hr_tax_dependents')
    .insert({ ...data, owner_id: ctx.ownerId, employee_id }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dependent: row })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: row, error } = await ctx.admin.from('hr_tax_dependents')
    .update({ ...pick(body), updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', ctx.ownerId).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dependent: row })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await ctx.admin.from('hr_tax_dependents').delete().eq('id', id).eq('owner_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
