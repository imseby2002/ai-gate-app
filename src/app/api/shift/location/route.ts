/**
 * POST /api/shift/location：只有一個營業點、沒有設定門市的公司，依公司資料（名稱、地址）建立預設營業點 MAIN，
 * 之後在「打卡」分頁設定座標即可打卡（員工不需指定門市）。已有門市時不動作。
 */
import { NextResponse } from 'next/server'
import { getShiftContext } from '@/lib/shift/scope'

export async function POST() {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!ctx.isAdmin) return NextResponse.json({ error: '只有公司負責人或公司 IT 可以建立營業點' }, { status: 403 })
  const { admin, ownerId } = ctx
  const { data: existing } = await admin.from('fin_stores').select('code').eq('owner_id', ownerId).limit(1)
  if (existing?.length) return NextResponse.json({ code: existing[0].code, created: false })
  const [{ data: brand }, { data: prof }] = await Promise.all([
    admin.from('mkt_brand').select('name, address').eq('owner_id', ownerId).maybeSingle(),
    admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle(),
  ])
  const { data: company } = prof?.company_id ? await admin.from('companies').select('name').eq('id', prof.company_id).maybeSingle() : { data: null }
  const name = String(brand?.name || company?.name || '總公司').trim()
  const code = 'MAIN'
  const { error: e1 } = await admin.from('fin_stores').insert({ owner_id: ownerId, code, name, short_name: name, address: String(brand?.address ?? ''), unit_type: 'store', active: true })
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  const { data: p } = await admin.from('pnl_stores').select('id').eq('owner_id', ownerId).eq('code', code).maybeSingle()
  if (!p) {
    const { error: e2 } = await admin.from('pnl_stores').insert({ owner_id: ownerId, code, name, kind: 'store' })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  return NextResponse.json({ code, created: true })
}
