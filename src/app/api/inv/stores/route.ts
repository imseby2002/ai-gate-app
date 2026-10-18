import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'

// 門市清單：fin_stores 的門市（含名稱）＋已匯入資料出現過的門市代碼。
// 綁定門市的帳號只回可操作的門市；只有一家時 locked_store 為該店。
export async function GET() {
  const ctx = await getUnitContextAny(['store', 'store_leader', 'audit'])
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const supabase = ctx.admin
  const ownerId = ctx.ownerId

  const { data: fin } = await supabase.from('fin_stores').select('code, name, unit_type, active').eq('owner_id', ownerId).order('code')
  const names = new Map<string, string>()
  for (const r of fin ?? []) if (r.code) names.set(String(r.code).trim(), String(r.name ?? '').trim())

  let codes: string[]
  if (ctx.storeCodes) {
    codes = ctx.storeCodes
  } else {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from('inv_movements').select('store').eq('owner_id', ownerId),
      supabase.from('inv_pos_sales').select('store').eq('owner_id', ownerId),
    ])
    const set = new Set<string>()
    for (const r of fin ?? []) if (r.code && r.active !== false && (r.unit_type ?? 'store') === 'store') set.add(String(r.code).trim())
    for (const r of [...(a ?? []), ...(b ?? [])]) if (r.store) set.add(String(r.store).trim())
    codes = [...set].sort()
  }
  const store_list = codes.map(code => ({ code, name: names.get(code) ?? '' }))
  const locked = ctx.storeCodes && ctx.storeCodes.length === 1 ? ctx.storeCodes[0] : null
  return NextResponse.json({ stores: codes, store_list, locked_store: locked, active_store: ctx.storeCode ?? null })
}
