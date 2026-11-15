import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { IDENTITY_KINDS, normalizeIdentity } from '@/lib/crm/normalize'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/crm/contacts/:id/identities { kind, value, label?, move? }
// 把 LINE / WhatsApp 等帳號綁到這位客人。若該帳號已屬於另一位客人，回 409；帶 move=true 則改綁過來。
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const kind = String(body.kind ?? '')
  if (!IDENTITY_KINDS.some(k => k.id === kind)) return NextResponse.json({ error: '不支援的帳號類型' }, { status: 400 })
  const value = normalizeIdentity(kind, body.value)
  if (!value) return NextResponse.json({ error: '帳號格式不正確' }, { status: 400 })

  const { data: contact } = await supabase.from('crm_contacts').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle()
  if (!contact) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const { data: existing } = await supabase.from('crm_identities').select('id, contact_id, crm_contacts(display_name)')
    .eq('owner_id', user.id).eq('kind', kind).eq('value', value).maybeSingle()
  if (existing && existing.contact_id !== id) {
    if (!body.move) {
      const other = existing.crm_contacts as unknown as { display_name: string | null } | null
      return NextResponse.json({ error: `此帳號已綁定在「${other?.display_name ?? '另一位客人'}」，可改用合併功能`, conflict_contact_id: existing.contact_id }, { status: 409 })
    }
    const { error } = await supabase.from('crm_identities').update({ contact_id: id, label: body.label ?? undefined }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, moved: true })
  }
  if (existing) return NextResponse.json({ ok: true })

  // 若客服已有這個帳號的對話，順便連起來
  let csId: string | null = null
  if (kind !== 'phone' && kind !== 'email' && kind !== 'other') {
    const { data: cs } = await supabase.from('cs_customers').select('id').eq('user_id', user.id).eq('from_id', String(body.value).trim()).limit(1).maybeSingle()
    csId = cs?.id ?? null
  }
  const { error } = await supabase.from('crm_identities').insert({
    owner_id: user.id, contact_id: id, kind, value,
    label: typeof body.label === 'string' ? body.label.slice(0, 100) : null,
    cs_customer_id: csId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/crm/contacts/:id/identities?identity_id=
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const identityId = req.nextUrl.searchParams.get('identity_id')
  if (!identityId) return NextResponse.json({ error: '缺少 identity_id' }, { status: 400 })
  const { error } = await supabase.from('crm_identities').delete().eq('id', identityId).eq('contact_id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
