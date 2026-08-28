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
    .select('foreman_telegram, foreman_email').eq('owner_id', user.id).eq('store', store).single()
  return NextResponse.json({ foreman_telegram: data?.foreman_telegram ?? '', foreman_email: data?.foreman_email ?? '' })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const { error } = await supabase.from('inv_store_contacts').upsert({
    owner_id: user.id, store,
    foreman_telegram: s(b.foreman_telegram), foreman_email: s(b.foreman_email),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,store' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
