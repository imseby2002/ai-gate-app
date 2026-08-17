import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyHR } from '@/lib/hr/notify'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

type SB = Awaited<ReturnType<typeof createClient>>

// 差異分析：理論用量（售出×配方）vs 實際出庫；誤差% 超門檻警示；標準價換算金額損失
async function compute(supabase: SB, ownerId: string, store: string, year: number, month: number) {
  const [{ data: pos }, { data: map }, { data: items }, { data: mov }, { data: setting }, { data: prices }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name, qty').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
    supabase.from('inv_product_map').select('product_code, recipe_id').eq('owner_id', ownerId),
    supabase.from('inv_recipe_items').select('recipe_id, material_code, material_name, qty_per_cup').eq('owner_id', ownerId),
    supabase.from('inv_movements').select('material_code, material_name, unit, out_total, close_qty').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
    supabase.from('inv_settings').select('variance_threshold').eq('owner_id', ownerId).single(),
    supabase.from('inv_material_prices').select('material_code, export_price').eq('owner_id', ownerId),
  ])
  const threshold = Number(setting?.variance_threshold) || 10
  const priceOf: Record<string, number> = {}
  for (const p of prices ?? []) priceOf[p.material_code] = Number(p.export_price) || 0

  const recipeOf: Record<string, string | null> = {}
  for (const m of map ?? []) recipeOf[m.product_code] = m.recipe_id
  const itemsByRecipe: Record<string, { material_code: string; material_name: string; qty_per_cup: number }[]> = {}
  for (const it of items ?? []) (itemsByRecipe[it.recipe_id] ??= []).push(it)

  const theo: Record<string, { name: string; qty: number }> = {}
  const unmapped: { product_code: string; product_name: string; qty: number }[] = []
  for (const p of pos ?? []) {
    const rid = recipeOf[p.product_code]
    const cups = Number(p.qty) || 0
    if (!rid) { if (cups > 0) unmapped.push({ product_code: p.product_code, product_name: p.product_name, qty: cups }); continue }
    for (const it of itemsByRecipe[rid] ?? []) {
      const t = (theo[it.material_code] ??= { name: it.material_name, qty: 0 })
      t.qty += cups * (Number(it.qty_per_cup) || 0)
    }
  }

  const actualMap = new Map<string, { name: string; unit: string; out: number; close: number }>()
  for (const m of mov ?? []) actualMap.set(m.material_code, { name: m.material_name, unit: m.unit, out: Number(m.out_total) || 0, close: Number(m.close_qty) || 0 })

  const codes = new Set<string>([...Object.keys(theo), ...actualMap.keys()])
  const rows = [...codes].map(code => {
    const t = theo[code]?.qty ?? 0
    const a = actualMap.get(code)
    const actual = a?.out ?? 0
    const diff = actual - t
    const pct = t > 0 ? (diff / t) * 100 : (actual > 0 ? null : 0)
    const over = pct !== null && Math.abs(pct) > threshold
    const price = priceOf[code] ?? 0
    const money_loss = diff * price
    return {
      material_code: code,
      material_name: a?.name || theo[code]?.name || code,
      unit: a?.unit ?? '',
      theoretical: t, actual, remaining: a?.close ?? 0, diff, pct, over, price, money_loss,
    }
  }).filter(r => r.theoretical > 0 || r.actual > 0)
    .sort((x, y) => {
      const ax = x.pct === null ? -Infinity : Math.abs(x.pct)
      const ay = y.pct === null ? -Infinity : Math.abs(y.pct)
      return ay - ax
    })

  const total_loss = rows.reduce((s, r) => s + (r.diff > 0 ? r.money_loss : 0), 0)
  return { store, year, month, threshold, rows, unmapped, over_count: rows.filter(r => r.over).length, total_loss }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = (sp.get('store') ?? '').trim()
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  return NextResponse.json(await compute(supabase, user.id, store, year, month))
}

// 通知人事超標原料。body: { store, year, month }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const store = String(body.store ?? '').trim()
  const year = parseInt(body.year) || new Date().getFullYear()
  const month = parseInt(body.month) || (new Date().getMonth() + 1)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  const r = await compute(supabase, user.id, store, year, month)
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
