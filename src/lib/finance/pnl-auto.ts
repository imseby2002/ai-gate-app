/**
 * 業績損益報表自動彙總（門市 × 月份 × 科目）。
 *
 * 資料來源：
 * - 門市：fin_stores（門市資料）自動同步成 pnl_stores，另加「總部／未歸屬」欄放不出門市的金額
 * - 出納帳務 hr_cashflow：依「分類」對應科目，依「摘要」中的門市代碼／名稱歸屬門市
 *   （一筆提到多家門市就平均分攤；找不到門市的進「總部／未歸屬」）
 *   平台／批發收入與原物料採購不做門市歸屬，一律放總部
 * - 薪資 hr_payroll：薪資＝底薪＋津貼＋獎金；保險＝公司負擔保險＋工會費，依薪資表門市歸屬
 *   當月有薪資資料時，出納裡的 luong（薪資）與保險費用不重複計入
 * - 門市費用 fin_bills：水電瓦斯冰塊帳單；當月某科目有帳單時，該科目改用帳單、不再取出納
 * - iPOS 售出 inv_pos_sales：門市當月有 POS 資料時，營業額改用 POS（出納的門市現金繳回只做比對）
 * - 進銷存 inv_movements（INVENTORY 匯出）：原料使用＝規定用量×單價、原料損耗＝超用量×單價；
 *   當月有任何門市的進銷存資料時，出納的原物料採購不再計入（已轉為庫存，避免重複）
 *
 * 人工修改值（pnl_entries）優先於自動值，由 API／前端合併；修改留痕在 pnl_entry_logs。
 */
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const HQ_CODE = '__HQ__'

export interface PnlStoreRow {
  id: string; code: string; name: string; name_vi: string; kind: string; sort: number
  archived: boolean; fin_store_id: string | null; aliases: string[]
}

export interface Contribution {
  src: 'cashflow' | 'payroll' | 'bill' | 'pos' | 'inventory'
  label: string
  amount: number   // 已分攤後計入此門市的金額
  total: number    // 原始金額
  split: number    // 分攤家數
  date?: string
  category?: string
}

/** 去聲調、小寫、非英數轉空白 */
export function spaced(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
const compact = (s: unknown) => spaced(s).replace(/ /g, '')

// ── 門市同步 ──────────────────────────────────────────────
interface FinStore { id: string; code: string; name: string; short_name: string | null; unit_type: string | null; active: boolean }

/** 把門市資料（fin_stores）同步到損益表門市；回傳未封存門市（依 sort） */
export async function syncPnlStores(admin: Admin, ownerId: string): Promise<{ stores: PnlStoreRow[]; fin: FinStore[] }> {
  const [{ data: pnlRaw }, { data: finRaw }] = await Promise.all([
    admin.from('pnl_stores').select('id, code, name, name_vi, kind, sort, archived, fin_store_id, aliases').eq('owner_id', ownerId),
    admin.from('fin_stores').select('id, code, name, short_name, unit_type, active').eq('owner_id', ownerId).order('created_at'),
  ])
  const pnl = (pnlRaw ?? []) as PnlStoreRow[]
  const fin = ((finRaw ?? []) as FinStore[]).filter(f => f.active !== false)
  if (fin.length) {
    const inserts: Record<string, unknown>[] = []
    const now = new Date().toISOString()
    let sort = Math.max(0, ...pnl.map(p => p.sort)) + 1
    for (const f of fin) {
      let p = pnl.find(x => x.fin_store_id === f.id)
      if (!p) {
        p = pnl.find(x => !x.fin_store_id && (
          compact(x.code) === compact(f.code) || compact(x.name) === compact(f.name) || (x.name_vi && compact(x.name_vi) === compact(f.name))))
        if (p) {
          p.fin_store_id = f.id
          await admin.from('pnl_stores').update({ fin_store_id: f.id, updated_at: now }).eq('id', p.id).eq('owner_id', ownerId)
        }
      }
      if (!p && !pnl.some(x => x.code === f.code)) {
        const kind = f.unit_type === 'factory' || compact(f.code) === 'kho' ? 'warehouse' : compact(f.code) === 'vp' ? 'office' : 'store'
        inserts.push({ owner_id: ownerId, code: f.code, name: f.name, name_vi: f.name, kind, sort: sort++, fin_store_id: f.id })
      }
    }
    if (!pnl.some(x => x.code === HQ_CODE)) {
      inserts.push({ owner_id: ownerId, code: HQ_CODE, name: '總部／未歸屬', name_vi: 'Văn phòng / chưa phân bổ', kind: 'group', sort: 99999 })
    }
    if (inserts.length) {
      const { data } = await admin.from('pnl_stores').insert(inserts).select('id, code, name, name_vi, kind, sort, archived, fin_store_id, aliases')
      pnl.push(...((data ?? []) as PnlStoreRow[]))
    }
    // 首次建立的預設「A門市」沒有任何資料時封存
    const placeholder = pnl.find(x => x.code === 'STORE_A' && !x.fin_store_id && !x.archived)
    if (placeholder) {
      const { count } = await admin.from('pnl_entries').select('id', { count: 'exact', head: true }).eq('store_id', placeholder.id)
      if (!count) {
        await admin.from('pnl_stores').update({ archived: true, updated_at: now }).eq('id', placeholder.id).eq('owner_id', ownerId)
        placeholder.archived = true
      }
    }
  }
  const stores = pnl.filter(p => !p.archived).sort((a, b) => a.sort - b.sort)
  return { stores, fin }
}

/** 每家門市的比對別名（已正規化成「空白分隔」形式） */
function buildAliases(stores: PnlStoreRow[], fin: FinStore[]): Map<string, string[]> {
  const finBy = new Map(fin.map(f => [f.id, f]))
  const out = new Map<string, string[]>()
  for (const s of stores) {
    if (s.code === HQ_CODE) continue
    const f = s.fin_store_id ? finBy.get(s.fin_store_id) : undefined
    const raw = [s.code, s.name, s.name_vi, ...(s.aliases ?? []), f?.code, f?.name, f?.short_name]
    const set = new Set<string>()
    for (const r of raw) {
      const a = spaced(r)
      if (!a) continue
      set.add(a)
      set.add(a.replace(/_/g, ' '))
      const paren = String(r ?? '').match(/\(([^)]+)\)/)
      if (paren) set.add(spaced(paren[1]))
      const noNum = a.replace(/^\d+\s+/, '')
      if (noNum !== a) set.add(noNum)
      const first = noNum.split(' ')[0]
      if (first.length >= 5 && /^[a-z]+$/.test(first) && noNum.includes(' ')) set.add(first) // Royal Nguyễn Trãi → royal
    }
    out.set(s.id, Array.from(set).filter(a => a.length >= 2))
  }
  return out
}

/** 文字中提到的門市（整字比對） */
function findStores(text: string, aliases: Map<string, string[]>): string[] {
  const t = ` ${spaced(text)} `
  const hit: string[] = []
  for (const [id, list] of aliases) if (list.some(a => t.includes(` ${a} `))) hit.push(id)
  return hit
}

/** 薪資表的門市欄（代碼）→ 門市 */
function matchStoreCode(code: string, aliases: Map<string, string[]>): string | null {
  const c = spaced(code)
  if (!c) return null
  for (const [id, list] of aliases) if (list.includes(c)) return id
  return null
}

// ── 出納分類 → 科目 ─────────────────────────────────────────
const PAYROLL_COVERED = new Set(['salary', 'insurance'])

export function cashflowLine(type: string, parent: string, category: string): string | null {
  const p = String(parent ?? '').trim(), c = String(category ?? '').trim()
  const cv = spaced(c), pv = spaced(p)
  if (type === 'income') {
    if (p === '門市收入' || /^dt /.test(cv) || p.includes('批發收入')) return 'revenue'
    return null
  }
  if (type !== 'expense') return null
  if (cv === 'luong' || c === '薪資') return 'salary'
  if (p === '保險費用' || cv === 'bao hiem' || cv.includes('cong doan')) return 'insurance'
  if (c === '電費') return 'electric'
  if (c === '水費') return 'water'
  if (c === '瓦斯費') return 'gas'
  if (c === '電話費') return 'phone'
  if (c === '網路費') return 'internet'
  if (c === '房屋租金') return 'rent'
  if (p === '交通費用') return 'transport'
  if (cv === 'ipos') return 'pos_fee'
  if (c === '冰块' || c === '冰塊') return 'ice'
  if (['飲料原料', '餐點原料', '工廠耗材', '門市耗材'].includes(p) || cv.startsWith('thanh toan mua hang')) return 'material_used'
  if (cv.includes('sua chua') || pv.includes('sua chua')) return 'repair'
  return 'other_fee'
}

const BILL_LINE: Record<string, string> = { ELEC: 'electric', WATER: 'water', GAS: 'gas', ICE: 'ice' }

// ── 自動彙總 ──────────────────────────────────────────────
export type AutoValues = Record<string, Record<string, Record<string, number>>> // period → storeId → line → amount

const nextMonth = (p: string) => { const [y, m] = p.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` }
export const periodsBetween = (from: string, to: string) => { const out: string[] = []; for (let p = from; p <= to && out.length < 120; p = nextMonth(p)) out.push(p); return out }

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

interface CashRow { id: string; type: string; category: string; category_parent: string; amount: number; date: string; description: string; notes: string; store_code: string }
interface PayRow { year: number; month: number; store: string; base_salary: number; allowances: number; bonus: number; employer_insurance: number; employer_union: number }
interface BillRow { store_code: string; year: number; month: number; category_code: string; amount: number; note: string }
interface PosRow { store: string; year: number; month: number; revenue: number }
interface MovRow { store: string; year: number; month: number; material_code: string; material_name: string; out_pos: number; usage_month: number; open_qty: number; in_total: number; close_qty: number }

/** 營業額／庫存比對（每門市每月） */
export interface Recon {
  pos_revenue: number        // iPOS 營業額
  cash_revenue: number       // 出納「門市收入」（門市現金繳回）
  has_pos: boolean
  inv_expected: number       // 規定用量成本（POS 點單推算 × 單價）
  inv_actual: number         // 實耗成本（當月使用量 × 單價）
  inv_loss: number           // 超用金額（實耗 > 規定的部分）
  has_inv: boolean
  missing_price: number      // 有用量但沒有單價的原料數
}
export type ReconMap = Record<string, Record<string, Recon>> // period → storeId → recon
const emptyRecon = (): Recon => ({ pos_revenue: 0, cash_revenue: 0, has_pos: false, inv_expected: 0, inv_actual: 0, inv_loss: 0, has_inv: false, missing_price: 0 })

export async function computeAutoPnl(
  admin: Admin, ownerId: string, stores: PnlStoreRow[], fin: FinStore[],
  from: string, to: string,
  trace?: { period: string; storeId: string; line: string },
): Promise<{ values: AutoValues; contributions: Contribution[]; recon: ReconMap; purchasesSkipped: Record<string, number> }> {
  const aliases = buildAliases(stores, fin)
  const hq = stores.find(s => s.code === HQ_CODE)?.id ?? null
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)

  const [cash, pay, bills, posRows, movRows, prices] = await Promise.all([
    fetchAll<CashRow>((a, b) => admin.from('hr_cashflow')
      .select('id, type, category, category_parent, amount, date, description, notes, store_code')
      .eq('owner_id', ownerId).gte('date', `${from}-01`).lt('date', `${nextMonth(to)}-01`).order('id').range(a, b)),
    fetchAll<PayRow>((a, b) => admin.from('hr_payroll')
      .select('year, month, store, base_salary, allowances, bonus, employer_insurance, employer_union')
      .eq('owner_id', ownerId).gte('year', fy).lte('year', ty).order('id').range(a, b)),
    fetchAll<BillRow>((a, b) => admin.from('fin_bills')
      .select('store_code, year, month, category_code, amount, note')
      .eq('owner_id', ownerId).gte('year', fy).lte('year', ty).order('id').range(a, b)),
    fetchAll<PosRow>((a, b) => admin.from('inv_pos_sales')
      .select('store, year, month, revenue')
      .eq('owner_id', ownerId).gte('year', fy).lte('year', ty).order('id').range(a, b)),
    fetchAll<MovRow>((a, b) => admin.from('inv_movements')
      .select('store, year, month, material_code, material_name, out_pos, usage_month, open_qty, in_total, close_qty')
      .eq('owner_id', ownerId).gte('year', fy).lte('year', ty).order('id').range(a, b)),
    fetchAll<{ material_code: string; export_price: number }>((a, b) => admin.from('inv_material_prices')
      .select('material_code, export_price').eq('owner_id', ownerId).order('material_code').range(a, b)),
  ])

  const values: AutoValues = {}
  const contributions: Contribution[] = []
  const inRange = (p: string) => p >= from && p <= to
  const add = (period: string, storeId: string | null, line: string, amt: number, c: Omit<Contribution, 'amount'>) => {
    const sid = storeId ?? hq
    if (!sid || !amt) return
    const s = ((values[period] ??= {})[sid] ??= {})
    s[line] = (s[line] ?? 0) + amt
    if (trace && trace.period === period && trace.storeId === sid && trace.line === line) contributions.push({ ...c, amount: amt })
  }

  const recon: ReconMap = {}
  const rc = (period: string, sid: string) => ((recon[period] ??= {})[sid] ??= emptyRecon())

  // iPOS 營業額
  const posAgg = new Map<string, { period: string; sid: string | null; store: string; amt: number }>()
  for (const r of posRows) {
    const period = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (!inRange(period)) continue
    const sid = matchStoreCode(r.store, aliases)
    const k = `${period}|${sid ?? r.store}`
    const cur = posAgg.get(k) ?? { period, sid, store: r.store, amt: 0 }
    cur.amt += Number(r.revenue) || 0
    posAgg.set(k, cur)
  }
  const posStores = new Set<string>() // `${period}|${sid}`
  for (const g of posAgg.values()) {
    add(g.period, g.sid, 'revenue', g.amt, { src: 'pos', label: `iPOS 營業額（${g.store}）`, total: g.amt, split: 1 })
    const sid = g.sid ?? hq
    if (sid) { posStores.add(`${g.period}|${sid}`); const x = rc(g.period, sid); x.pos_revenue += g.amt; x.has_pos = true }
  }

  // 進銷存（INVENTORY）：規定用量＝Xuất bán POS、實耗＝lượng dùng tháng（未填則 期初＋進貨−期末）
  const priceOf = new Map(prices.map(p => [p.material_code, Number(p.export_price) || 0]))
  const invPeriods = new Set<string>()
  const invAgg = new Map<string, { period: string; sid: string | null; store: string; exp: number; act: number; loss: number; miss: number }>()
  for (const m of movRows) {
    const period = `${m.year}-${String(m.month).padStart(2, '0')}`
    if (!inRange(period)) continue
    invPeriods.add(period)
    const sid = matchStoreCode(m.store, aliases)
    const k = `${period}|${sid ?? m.store}`
    const g = invAgg.get(k) ?? { period, sid, store: m.store, exp: 0, act: 0, loss: 0, miss: 0 }
    const expected = Number(m.out_pos) || 0
    const usage = Number(m.usage_month) || 0
    const actual = usage > 0 ? usage : (Number(m.open_qty) || 0) + (Number(m.in_total) || 0) - (Number(m.close_qty) || 0)
    const price = priceOf.get(m.material_code) ?? 0
    if (!price && (expected || actual)) g.miss++
    g.exp += expected * price
    g.act += actual * price
    if (actual > expected) g.loss += (actual - expected) * price
    invAgg.set(k, g)
  }
  for (const g of invAgg.values()) {
    add(g.period, g.sid, 'material_used', g.exp, { src: 'inventory', label: `進銷存規定用量成本（${g.store}）`, total: g.exp, split: 1 })
    add(g.period, g.sid, 'material_loss', g.loss, { src: 'inventory', label: `進銷存超用金額（${g.store}）`, total: g.loss, split: 1 })
    const sid = g.sid ?? hq
    if (sid) { const x = rc(g.period, sid); x.inv_expected += g.exp; x.inv_actual += g.act; x.inv_loss += g.loss; x.has_inv = true; x.missing_price += g.miss }
  }
  const purchasesSkipped: Record<string, number> = {}

  // 薪資
  const payrollPeriods = new Set<string>()
  for (const r of pay) {
    const period = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (!inRange(period) || (r.year === fy && r.month < fm) || (r.year === ty && r.month > tm)) continue
    payrollPeriods.add(period)
    const sid = matchStoreCode(r.store, aliases)
    const gross = (Number(r.base_salary) || 0) + (Number(r.allowances) || 0) + (Number(r.bonus) || 0)
    const ins = (Number(r.employer_insurance) || 0) + (Number(r.employer_union) || 0)
    const label = `薪資表 ${period}（${r.store || '未填門市'}）`
    add(period, sid, 'salary', gross, { src: 'payroll', label, total: gross, split: 1 })
    add(period, sid, 'insurance', ins, { src: 'payroll', label: `${label} 公司負擔保險`, total: ins, split: 1 })
  }

  // 門市費用帳單
  const billLines = new Set<string>() // `${period}|${line}`
  for (const r of bills) {
    const period = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (!inRange(period)) continue
    const line = BILL_LINE[r.category_code] ?? 'other_fee'
    billLines.add(`${period}|${line}`)
    const amt = Number(r.amount) || 0
    add(period, matchStoreCode(r.store_code, aliases), line, amt, { src: 'bill', label: `門市費用 ${r.store_code} ${r.category_code}${r.note ? `：${r.note}` : ''}`, total: amt, split: 1 })
  }

  // 出納帳務
  for (const r of cash) {
    const period = String(r.date).slice(0, 7)
    const line = cashflowLine(r.type, r.category_parent, r.category)
    if (!line) continue
    if (PAYROLL_COVERED.has(line) && payrollPeriods.has(period)) continue
    if (billLines.has(`${period}|${line}`)) continue
    const amt = Number(r.amount) || 0
    if (!amt) continue
    // 只有門市收入與門市費用依摘要歸屬門市；平台／批發收入、原物料採購（總倉統一進貨，摘要常含發票號 hd…）留在總部
    const attributable = line === 'revenue' ? String(r.category_parent ?? '').trim() === '門市收入' : line !== 'material_used'
    const direct = r.store_code ? matchStoreCode(r.store_code, aliases) : null
    const hits = direct ? [direct] : attributable ? findStores(`${r.description ?? ''} ${r.notes ?? ''}`, aliases) : []
    if (line === 'material_used' && invPeriods.has(period)) { purchasesSkipped[period] = (purchasesSkipped[period] ?? 0) + amt; continue }
    const base = { src: 'cashflow' as const, label: r.description || r.category, total: amt, date: r.date, category: [r.category_parent, r.category].filter(Boolean).join(' / ') }
    const targets = hits.length ? hits : [null]
    for (const t of targets) {
      const share = amt / targets.length
      const sid = t ?? hq
      // 門市收入：記入比對；該門市當月已有 POS 營業額時不再計入損益表
      if (line === 'revenue' && String(r.category_parent ?? '').trim() === '門市收入' && sid) {
        rc(period, sid).cash_revenue += share
        if (posStores.has(`${period}|${sid}`)) continue
      }
      add(period, t, line, share, { ...base, split: targets.length })
    }
  }

  for (const p of Object.keys(values)) for (const s of Object.keys(values[p])) for (const l of Object.keys(values[p][s])) {
    values[p][s][l] = Math.round(values[p][s][l])
  }
  for (const p of Object.keys(recon)) for (const s of Object.keys(recon[p])) {
    const x = recon[p][s]
    for (const k of ['pos_revenue', 'cash_revenue', 'inv_expected', 'inv_actual', 'inv_loss'] as const) x[k] = Math.round(x[k])
  }
  return { values, contributions, recon, purchasesSkipped }
}
