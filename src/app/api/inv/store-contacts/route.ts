import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()

// 某門市領班聯絡管道（緊急低於安全量時通知）
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = s(new URL(req.url).searchParams.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const { data } = await supabase.from('inv_store_contacts')
    .select('foreman_telegram, foreman_email, mgmt_telegram, mgmt_email, audit_telegram, audit_email, office_telegram, office_email')
    .eq('owner_id', user.id).eq('store', store).single()
  return NextResponse.json({
    foreman_telegram: data?.foreman_telegram ?? '', foreman_email: data?.foreman_email ?? '',
    mgmt_telegram: data?.mgmt_telegram ?? '', mgmt_email: data?.mgmt_email ?? '',
    audit_telegram: data?.audit_telegram ?? '', audit_email: data?.audit_email ?? '',
    office_telegram: data?.office_telegram ?? '', office_email: data?.office_email ?? '',
  })
}

const CONTACT_FIELDS = [
  'foreman_telegram', 'foreman_email', 'mgmt_telegram', 'mgmt_email',
  'audit_telegram', 'audit_email', 'office_telegram', 'office_email',
] as const

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const patch: Record<string, unknown> = { owner_id: user.id, store, updated_at: new Date().toISOString() }
  for (const f of CONTACT_FIELDS) if (b[f] !== undefined) patch[f] = s(b[f])
  const { error } = await supabase.from('inv_store_contacts').upsert(patch, { onConflict: 'owner_id,store' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
