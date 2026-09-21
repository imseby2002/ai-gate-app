import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { notifyHR } from '@/lib/hr/notify'
import { computeInventoryVariance } from '@/lib/inv/variance-engine'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['store', 'audit', 'rd', 'finance'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, storeCode: null , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, storeCode: ctx.storeCode , status: ctx.status }
}

export async function GET(req: NextRequest) {
  const { user, supabase, storeCode , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  const sp = new URL(req.url).searchParams
  const store = storeCode || (sp.get('store') ?? '').trim()
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  return NextResponse.json(await computeInventoryVariance(supabase, user.id, store, year, month))
}

// 通知人事超標原料。body: { store, year, month }
export async function POST(req: NextRequest) {
  const { user, supabase, storeCode , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
  const body = await req.json().catch(() => ({}))
  const store = storeCode || String(body.store ?? '').trim()
  const year = parseInt(body.year) || new Date().getFullYear()
  const month = parseInt(body.month) || (new Date().getMonth() + 1)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  const r = await computeInventoryVariance(supabase, user.id, store, year, month)
  const overRows = r.rows.filter(x => x.over)
  if (overRows.length === 0) return NextResponse.json({ over_count: 0, notified: false })

  const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
  const top = overRows.slice(0, 10).map(x => `${x.material_name} ${x.pct === null ? '' : (x.pct > 0 ? '+' : '') + Math.round(x.pct) + '%'}`).join('、')
  await notifyHR(user.id, {
    kind: 'inv_variance',
    title: `⚠️ ${store} ${year}/${month} 進銷存誤差超標`,
    body: `${overRows.length} 項原料誤差超過 ${r.threshold}%：${top}${overRows.length > 10 ? '…' : ''}。估計金額損失約 ${fmt(r.total_loss)}。`,
  }).catch(() => {})

  return NextResponse.json({ over_count: overRows.length, total_loss: r.total_loss, notified: true })
}
