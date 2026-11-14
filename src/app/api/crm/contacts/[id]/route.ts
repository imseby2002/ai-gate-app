import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { normalizeEmail, normalizePhone } from '@/lib/crm/normalize'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/crm/contacts/:id → 客人完整資料（基本資料、所有帳號、所有預約／訂房／購買／對話紀錄）
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const [{ data: contact }, { data: identities }, { data: activities }] = await Promise.all([
    supabase.from('crm_contacts').select('*').eq('id', id).eq('owner_id', user.id).maybeSingle(),
    supabase.from('crm_identities').select('id, kind, value, label, cs_customer_id, created_at').eq('contact_id', id).eq('owner_id', user.id).order('created_at'),
    supabase.from('crm_activities').select('id, source, source_id, kind, title, amount, currency, status, occurred_at, meta').eq('contact_id', id).eq('owner_id', user.id).order('occurred_at', { ascending: false }).limit(500),
  ])
  if (!contact) return NextResponse.json({ error: '找不到客人' }, { status: 404 })
  return NextResponse.json({ contact, identities: identities ?? [], activities: activities ?? [] })
}

// PATCH /api/crm/contacts/:id → 更新姓名、特質、標籤、備註等
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['display_name', 'gender', 'country', 'traits', 'notes'] as const) {
    if (k in body) patch[k] = typeof body[k] === 'string' ? body[k].slice(0, 5000) || null : null
  }
  if ('birthday' in body) patch.birthday = /^\d{4}-\d{2}-\d{2}$/.test(body.birthday ?? '') ? body.birthday : null
  if ('phone' in body) patch.phone = normalizePhone(body.phone)
  if ('email' in body) patch.email = normalizeEmail(body.email)
  if (Array.isArray(body.tags)) patch.tags = [...new Set(body.tags.map((t: unknown) => String(t).trim()).filter(Boolean))].slice(0, 30)

  const { error } = await supabase.from('crm_contacts').update(patch).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const idents = [patch.phone && { kind: 'phone', value: patch.phone }, patch.email && { kind: 'email', value: patch.email }].filter(Boolean) as { kind: string; value: string }[]
  if (idents.length) {
    await supabase.from('crm_identities').upsert(
      idents.map(i => ({ ...i, owner_id: user.id, contact_id: id })),
      { onConflict: 'owner_id,kind,value', ignoreDuplicates: true },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const { error } = await supabase.from('crm_contacts').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
