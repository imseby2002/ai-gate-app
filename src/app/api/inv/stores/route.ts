import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, storeCode: null as string | null }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, storeCode: ctx.storeCode ?? null }
}

// 已匯入資料中出現過的門市清單
export async function GET() {
  const { user, supabase, storeCode } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (storeCode) {
    return NextResponse.json({ stores: [storeCode], locked_store: storeCode })
  }

  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from('inv_movements').select('store').eq('owner_id', user.id),
    supabase.from('inv_pos_sales').select('store').eq('owner_id', user.id),
  ])
  const set = new Set<string>()
  for (const r of [...(a ?? []), ...(b ?? [])]) if (r.store) set.add(r.store)
  return NextResponse.json({ stores: [...set].sort(), locked_store: null })
}
