import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 某門市的原料清單（來自進銷存）＋帳面庫存（最近月份期末數）。供盤點表／安全表帶入。
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = (new URL(req.url).searchParams.get('store') ?? '').trim()
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  const { data } = await supabase.from('inv_movements')
    .select('material_code, material_name, unit, close_qty, year, month')
    .eq('owner_id', user.id).eq('store', store)
    .order('year', { ascending: false }).order('month', { ascending: false })

  const seen = new Map<string, { material_code: string; material_name: string; unit: string; book_qty: number }>()
  for (const m of data ?? []) {
    if (seen.has(m.material_code)) continue // 已取最近月份
    seen.set(m.material_code, { material_code: m.material_code, material_name: m.material_name, unit: m.unit, book_qty: Number(m.close_qty) || 0 })
  }
  return NextResponse.json({ materials: [...seen.values()] })
}
