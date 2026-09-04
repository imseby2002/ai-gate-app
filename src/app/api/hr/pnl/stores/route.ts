import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const KINDS = ['store', 'warehouse', 'office', 'group']

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const { code, name, name_vi, kind, sort } = body
  if (!code || !name) return NextResponse.json({ error: 'code 與 name 為必填' }, { status: 400 })

  const { data, error } = await supabase.from('pnl_stores').insert({
    owner_id: user.id,
    code: String(code).trim(),
    name: String(name).trim(),
    name_vi: name_vi ?? '',
    kind: KINDS.includes(kind) ? kind : 'store',
    sort: Number(sort) || 0,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ store: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (updates.kind && !KINDS.includes(updates.kind)) delete updates.kind

  const { data, error } = await supabase.from('pnl_stores')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ store: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 連同該門市所有格值一併刪除（FK on delete cascade）
  const { error } = await supabase.from('pnl_stores')
    .delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
