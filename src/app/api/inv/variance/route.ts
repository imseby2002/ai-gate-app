import { getUnitContext } from '@/lib/auth/unit-access'
import type { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyHR } from '@/lib/hr/notify'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

type SB = Awaited<ReturnType<typeof createClient>>

// 智能差異：直接採用 IVT 檔本身的兩欄——
//   規定用量＝「Xuất bán POS」(out_pos，依點單推算的應耗)；實耗＝「lượng dùng tháng」(usage_month)。
//   差額／誤差% 即檔內 chenh／phan tram。配方理論(售出×配方，含 TOPPING 排擠負值)僅作對照參考。
//   誤差% 超門檻警示；標準價換算金額損失；並附交叉檢核與「加料排擠」可能性分析。
async function compute(supabase: SB, ownerId: string, store: string, year: number, month: number) {
  const [{ data: pos }, { data: map }, { data: items }, { data: mov }, { data: setting }, { data: prices }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name, qty').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
    supabase.from('inv_product_map').select('product_code, recipe_id, kind').eq('owner_id', ownerId),
    supabase.from('inv_recipe_items').select('recipe_id, material_code, material_name, qty_per_cup').eq('owner_id', ownerId),
    supabase.from('inv_movements').select('material_code, material_name, unit, open_qty, in_total, out_pos, out_total, close_qty, usage_month').eq('owner_id', ownerId).eq('store', store).eq('year', year).eq('month', month),
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

  // 配方理論用量（僅對照參考；不作為差額基準）
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

  // 檔內兩欄：規定用量(out_pos＝Xuất bán POS) 與 實耗(usage_month＝lượng dùng tháng)。
  // usage_month 未填才退回 期初＋叫貨−期末。
  const movMap = new Map<string, { name: string; unit: string; expected: number; actual: number; close: number }>()
  for (const m of mov ?? []) {
    const computed = (Number(m.open_qty) || 0) + (Number(m.in_total) || 0) - (Number(m.close_qty) || 0)
    const usageMonth = Number(m.usage_month) || 0
    const actual = usageMonth > 0 ? usageMonth : computed
    movMap.set(m.material_code, { name: m.material_name, unit: m.unit, expected: Number(m.out_pos) || 0, actual, close: Number(m.close_qty) || 0 })
  }

  const codes = new Set<string>([...movMap.keys(), ...Object.keys(theo)])
  const rows = [...codes].map(code => {
    const mv = movMap.get(code)
    const expected = mv?.expected ?? 0         // 規定用量（POS 點單推算）
    const actual = mv?.actual ?? 0             // 實耗（當月使用量）
    const recipe_theo = theo[code]?.qty ?? 0   // 配方理論（對照）
    const diff = actual - expected             // ＝檔內 chenh
    const pct = expected > 0 ? (diff / expected) * 100 : (actual > 0 ? null : 0) // ＝檔內 phan tram
    const over = pct !== null && Math.abs(pct) > threshold
    const price = priceOf[code] ?? 0
    const money_loss = diff * price
    return {
      material_code: code,
      material_name: mv?.name || theo[code]?.name || code,
      unit: mv?.unit ?? '',
      expected, actual, recipe_theo, remaining: mv?.close ?? 0, diff, pct, over, price, money_loss,
    }
  }).filter(r => Math.abs(r.expected) > 0.0001 || Math.abs(r.actual) > 0.0001 || Math.abs(r.recipe_theo) > 0.0001)
    .sort((x, y) => {
      const ax = x.pct === null ? -Infinity : Math.abs(x.pct)
      const ay = y.pct === null ? -Infinity : Math.abs(y.pct)
      return ay - ax
    })

  const total_loss = rows.reduce((s, r) => s + (r.diff > 0 ? r.money_loss : 0), 0)

  // ── 交叉檢核 ──
  const cupCode = setting?.cup_code ?? ''
  const teaCode = setting?.tea_code ?? ''
  const creamerCode = setting?.creamer_code ?? ''
  const teaPerCup = Number(setting?.tea_per_cup) || 0
  const creamerPerCup = Number(setting?.creamer_per_cup) || 0
  const actualOf = (code: string) => (code ? movMap.get(code)?.actual ?? null : null)
  const expectedOf = (code: string) => (code ? movMap.get(code)?.expected ?? null : null)
  const cupUsed = actualOf(cupCode)
  const teaUsed = actualOf(teaCode)
  const creamerUsed = actualOf(creamerCode)
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

  // ── 加料排擠可能性分析 ──
  // POS 點單只記錄「單一或無 topping」，故規定用量(out_pos)對茶／奶精偏高：
  // 客人實際多加 topping 時基底(茶／奶精)被排擠 → 實耗 < 規定。
  // 若 tea_gap 為正（茶「少用」），很可能由多加料訂單解釋，而非短少／浪費。
  const gapAnalysis = (code: string, perCup: number) => {
    const exp = expectedOf(code)
    const act = actualOf(code)
    if (exp === null || act === null) return null
    const gap = exp - act                                   // 正＝實際少用（可能被加料排擠）
    return { expected: exp, actual: act, gap, gap_cups: perCup > 0 ? gap / perCup : null }
  }

  // 深化：由各 topping 原料「規定 vs 實耗」推算實際多做的加料份數，
  // 再乘上該加料配方對茶／奶精的排擠量，估算能解釋多少基底少用。
  const baseCodes = new Set([teaCode, creamerCode, cupCode].filter(Boolean))
  // 收集 kind='topping' 成品所綁配方
  const toppingRecipeIds = new Set<string>()
  for (const pcode of Object.keys(kindOf)) {
    if (kindOf[pcode] === 'topping' && recipeOf[pcode]) toppingRecipeIds.add(recipeOf[pcode] as string)
  }
  // 每個加料配方：主原料(最大正值、非基底) ＋ 對茶／奶精的排擠量(負值取絕對值)
  const toppingInfo = new Map<string, { name: string; per: number; tea_disp: number; creamer_disp: number }>()
  for (const rid of toppingRecipeIds) {
    const its = itemsByRecipe[rid] ?? []
    let teaDisp = 0, creamerDisp = 0
    let primary: { code: string; name: string; qty: number } | null = null
    for (const it of its) {
      const q = Number(it.qty_per_cup) || 0
      if (teaCode && it.material_code === teaCode && q < 0) teaDisp += -q
      if (creamerCode && it.material_code === creamerCode && q < 0) creamerDisp += -q
      if (q > 0 && !baseCodes.has(it.material_code) && (!primary || q > primary.qty)) {
        primary = { code: it.material_code, name: it.material_name, qty: q }
      }
    }
    if (primary) {
      const prev = toppingInfo.get(primary.code)
      // 同一原料被多個加料配方引用時，累加排擠量、per 取較大者
      toppingInfo.set(primary.code, {
        name: primary.name,
        per: Math.max(prev?.per ?? 0, primary.qty),
        tea_disp: (prev?.tea_disp ?? 0) + teaDisp,
        creamer_disp: (prev?.creamer_disp ?? 0) + creamerDisp,
      })
    }
  }

  let teaExplained = 0, creamerExplained = 0
  const toppings = [...toppingInfo.entries()].map(([code, info]) => {
    const exp = expectedOf(code) ?? 0        // 規定份數×per
    const act = actualOf(code) ?? 0          // 實耗
    const servings_expected = info.per > 0 ? exp / info.per : 0
    const servings_actual = info.per > 0 ? act / info.per : 0
    const extra_servings = servings_actual - servings_expected // 正＝實際多做的加料份數
    teaExplained += extra_servings * info.tea_disp
    creamerExplained += extra_servings * info.creamer_disp
    return {
      material_code: code, material_name: info.name,
      servings_expected, servings_actual, extra_servings,
      tea_disp: info.tea_disp, creamer_disp: info.creamer_disp,
    }
  }).filter(t => Math.abs(t.servings_expected) > 0.001 || Math.abs(t.servings_actual) > 0.001)
    .sort((a, b) => b.extra_servings - a.extra_servings)

  const teaGap = teaCode ? (expectedOf(teaCode) ?? 0) - (actualOf(teaCode) ?? 0) : 0
  const creamerGap = creamerCode ? (expectedOf(creamerCode) ?? 0) - (actualOf(creamerCode) ?? 0) : 0
  const extra_topping_servings = toppings.reduce((s, t) => s + Math.max(0, t.extra_servings), 0)
  const possibility = {
    configured: !!(teaCode || creamerCode),
    tea: teaCode ? gapAnalysis(teaCode, teaPerCup) : null,
    creamer: creamerCode ? gapAnalysis(creamerCode, creamerPerCup) : null,
    toppings,
    extra_topping_servings,
    tea_explained: teaExplained,          // 加料排擠可解釋的茶少用量
    creamer_explained: creamerExplained,
    tea_explained_pct: teaGap > 0.001 ? Math.min(999, (teaExplained / teaGap) * 100) : null,
    creamer_explained_pct: creamerGap > 0.001 ? Math.min(999, (creamerExplained / creamerGap) * 100) : null,
    has_displacement: teaExplained > 0.001 || creamerExplained > 0.001,
  }

  return { store, year, month, threshold, rows, unmapped, over_count: rows.filter(r => r.over).length, total_loss, cross_checks: crossChecks, possibility }
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
