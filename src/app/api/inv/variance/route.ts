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

// 智能差異：理論用量（售出×配方，含 TOPPING 排擠負值）vs 實耗（IVT 期初＋叫貨−期末）；
// 誤差% 超門檻警示；標準價換算金額損失；並附多重交叉檢核。
async function compute(supabase: SB, ownerId: string, store: string, year: number, month: number) {
  const [{ data: pos }, { data: map }, { data: items }, { data: mov }, { data: setting }, { data: prices }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name, qty').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
    supabase.from('inv_product_map').select('product_code, recipe_id, kind').eq('owner_id', ownerId),
    supabase.from('inv_recipe_items').select('recipe_id, material_code, material_name, qty_per_cup').eq('owner_id', ownerId),
    supabase.from('inv_movements').select('material_code, material_name, unit, open_qty, in_total, out_total, close_qty').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
    supabase.from('inv_settings').select('variance_threshold, cup_code, tea_code, creamer_code, tea_per_cup, creamer_per_cup').eq('owner_id', ownerId).single(),
    supabase.from('inv_material_prices').select('material_code, export_price').eq('owner_id', ownerId),
  ])
  const threshold = Number(setting?.variance_threshold) || 10
  const priceOf: Record<string, number> = {}
  for (const p of prices ?? []) priceOf[p.material_code] = Number(p.export_price) || 0

  const recipeOf: Record<string, string | null> = {}
  const kindOf: Record<string, string> = {}
  for (const m of map ?? []) { recipeOf[m.product_code] = m.recipe_id; kindOf[m.product_code] = m.kind ?? '' }
  const itemsByRecipe: Record<string, { material_code: string; material_name: string; qty_per_cup: number }[]> = {}
  for (const it of items ?? []) (itemsByRecipe[it.recipe_id] ??= []).push(it)

  const theo: Record<string, { name: string; qty: number }> = {}
  const unmapped: { product_code: string; product_name: string; qty: number }[] = []
  let cupsSold = 0 // 售出杯數（飲料類）
  for (const p of pos ?? []) {
    const rid = recipeOf[p.product_code]
    const cups = Number(p.qty) || 0
    if (kindOf[p.product_code] === 'drink') cupsSold += cups
    if (!rid) { if (cups > 0) unmapped.push({ product_code: p.product_code, product_name: p.product_name, qty: cups }); continue }
    for (const it of itemsByRecipe[rid] ?? []) {
      const t = (theo[it.material_code] ??= { name: it.material_name, qty: 0 })
      t.qty += cups * (Number(it.qty_per_cup) || 0) // qty_per_cup 可為負（TOPPING 排擠基底）
    }
  }

  // 實耗 = 期初 ＋ 叫貨(入庫) − 期末
  const actualMap = new Map<string, { name: string; unit: string; used: number; close: number }>()
  for (const m of mov ?? []) {
    const used = (Number(m.open_qty) || 0) + (Number(m.in_total) || 0) - (Number(m.close_qty) || 0)
    actualMap.set(m.material_code, { name: m.material_name, unit: m.unit, used, close: Number(m.close_qty) || 0 })
  }

  const codes = new Set<string>([...Object.keys(theo), ...actualMap.keys()])
  const rows = [...codes].map(code => {
    const t = theo[code]?.qty ?? 0
    const a = actualMap.get(code)
    const actual = a?.used ?? 0
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
  }).filter(r => Math.abs(r.theoretical) > 0.0001 || Math.abs(r.actual) > 0.0001)
    .sort((x, y) => {
      const ax = x.pct === null ? -Infinity : Math.abs(x.pct)
      const ay = y.pct === null ? -Infinity : Math.abs(y.pct)
      return ay - ax
    })

  const total_loss = rows.reduce((s, r) => s + (r.diff > 0 ? r.money_loss : 0), 0)

  // ── 多重交叉檢核 ──
  const usedOf = (code: string) => (code ? actualMap.get(code)?.used ?? null : null)
  const cupCode = setting?.cup_code ?? ''
  const teaCode = setting?.tea_code ?? ''
  const creamerCode = setting?.creamer_code ?? ''
  const teaPerCup = Number(setting?.tea_per_cup) || 0
  const creamerPerCup = Number(setting?.creamer_per_cup) || 0
  const cupUsed = usedOf(cupCode)
  const teaUsed = usedOf(teaCode)
  const creamerUsed = usedOf(creamerCode)
  const impliedByTea = teaPerCup > 0 && teaUsed !== null ? teaUsed / teaPerCup : null
  const impliedByCreamer = creamerPerCup > 0 && creamerUsed !== null ? creamerUsed / creamerPerCup : null
  const crossChecks = {
    cups_sold: cupsSold,                 // 售出杯數（飲料）
    cup_used: cupUsed,                   // 杯子實耗
    cup_diff: cupUsed === null ? null : cupUsed - cupsSold,
    tea_used: teaUsed, creamer_used: creamerUsed,
    ratio_actual: teaUsed !== null && creamerUsed && creamerUsed !== 0 ? teaUsed / creamerUsed : null,
    ratio_recipe: teaPerCup > 0 && creamerPerCup > 0 ? teaPerCup / creamerPerCup : null,
    implied_cups_tea: impliedByTea,      // 由茶反推杯數
    implied_cups_creamer: impliedByCreamer,
    configured: !!(cupCode || teaCode || creamerCode),
  }

  return { store, year, month, threshold, rows, unmapped, over_count: rows.filter(r => r.over).length, total_loss, cross_checks: crossChecks }
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
