import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { syncPnlStores, computeAutoPnl, periodsBetween } from '@/lib/finance/pnl-auto'
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>
const PERIOD_RE = /^\d{4}-\d{2}$/

const shift = (p: string, n: number) => {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function actorName(admin: Admin, userId: string) {
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  return String(data?.full_name || data?.email || '')
}

// GET /api/hr/pnl?period=YYYY-MM          多店比較：門市、自動值、人工值、修改次數
// GET /api/hr/pnl?store_id=…&months=12   單店趨勢：近 N 個月的自動值與人工值
export async function GET(req: NextRequest) {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId } = ctx
  const sp = req.nextUrl.searchParams
  const period = sp.get('period') ?? ''
  const storeId = sp.get('store_id') ?? ''

  try {
    const { stores, fin } = await syncPnlStores(admin, ownerId)
    const { data: periodsRaw } = await admin.from('pnl_entries').select('period').eq('owner_id', ownerId)
    const periods = Array.from(new Set((periodsRaw ?? []).map(r => r.period))).sort().reverse()

    if (storeId) {
      const months = Math.min(36, Math.max(1, Number(sp.get('months')) || 12))
      const to = shift(new Date().toISOString().slice(0, 7), 0)
      const from = shift(to, -(months - 1))
      const [{ values }, { data: entries }] = await Promise.all([
        computeAutoPnl(admin, ownerId, stores, fin, from, to),
        admin.from('pnl_entries').select('period, line_code, amount, source').eq('owner_id', ownerId).eq('store_id', storeId),
      ])
      const auto: Record<string, Record<string, number>> = {}
      for (const p of periodsBetween(from, to)) auto[p] = values[p]?.[storeId] ?? {}
      return NextResponse.json({ stores, auto, series: entries ?? [], periods })
    }

    if (!PERIOD_RE.test(period)) return NextResponse.json({ stores, entries: [], auto: {}, periods, logCounts: {} })
    const [{ values, recon, purchasesSkipped }, { data: entries, error }, { data: logs }] = await Promise.all([
      computeAutoPnl(admin, ownerId, stores, fin, period, period),
      admin.from('pnl_entries').select('store_id, line_code, amount, source, updated_at').eq('owner_id', ownerId).eq('period', period),
      admin.from('pnl_entry_logs').select('store_id, line_code').eq('owner_id', ownerId).eq('period', period),
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const logCounts: Record<string, number> = {}
    for (const l of logs ?? []) logCounts[`${l.store_id}|${l.line_code}`] = (logCounts[`${l.store_id}|${l.line_code}`] ?? 0) + 1
    return NextResponse.json({
      stores, entries: entries ?? [], auto: values[period] ?? {}, periods, logCounts,
      recon: recon[period] ?? {}, purchasesSkipped: purchasesSkipped[period] ?? 0,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// PUT /api/hr/pnl  人工修改（覆蓋自動值），每格留痕
// body: { period, source?, reason?, values: { store_id, line_code, amount }[] }
export async function PUT(req: NextRequest) {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId, userId } = ctx

  const body = await req.json().catch(() => null)
  const period: string = body?.period ?? ''
  const source: string = ['manual', 'import', 'cashflow'].includes(body?.source) ? body.source : 'manual'
  const reason = String(body?.reason ?? '').trim().slice(0, 500)
  const values = Array.isArray(body?.values) ? body.values : []
  if (!PERIOD_RE.test(period)) return NextResponse.json({ error: 'period 格式須為 YYYY-MM' }, { status: 400 })
  if (values.length === 0) return NextResponse.json({ error: '沒有可寫入的資料' }, { status: 400 })
  if (values.length > 5000) return NextResponse.json({ error: '單次最多 5000 格' }, { status: 400 })
  if (source === 'manual' && !reason) return NextResponse.json({ error: '請填寫修改原因' }, { status: 400 })

  const { data: storeRows } = await admin.from('pnl_stores').select('id').eq('owner_id', ownerId)
  const validStore = new Set((storeRows ?? []).map(s => s.id))
  const now = new Date().toISOString()
  const rows: { owner_id: string; store_id: string; period: string; line_code: string; amount: number; source: string; updated_at: string }[] = []
  for (const v of values) {
    const amount = Number(v?.amount)
    if (!v?.store_id || !validStore.has(v.store_id) || !v?.line_code || !Number.isFinite(amount)) continue
    rows.push({ owner_id: ownerId, store_id: v.store_id, period, line_code: String(v.line_code), amount, source, updated_at: now })
  }
  if (rows.length === 0) return NextResponse.json({ error: '無有效資料' }, { status: 400 })

  // 留痕：修改前顯示值（人工值或自動值）
  const [{ stores, fin }, { data: oldEntries }, name] = await Promise.all([
    syncPnlStores(admin, ownerId),
    admin.from('pnl_entries').select('store_id, line_code, amount').eq('owner_id', ownerId).eq('period', period),
    actorName(admin, userId),
  ])
  const { values: auto } = await computeAutoPnl(admin, ownerId, stores, fin, period, period)
  const oldBy = new Map((oldEntries ?? []).map(e => [`${e.store_id}|${e.line_code}`, Number(e.amount)]))

  const { error } = await admin.from('pnl_entries').upsert(rows, { onConflict: 'owner_id,store_id,period,line_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const logs = rows.map(r => {
    const autoAmt = auto[period]?.[r.store_id]?.[r.line_code] ?? 0
    const key = `${r.store_id}|${r.line_code}`
    return {
      owner_id: ownerId, store_id: r.store_id, period, line_code: r.line_code, action: 'set',
      old_amount: oldBy.has(key) ? oldBy.get(key) : autoAmt, new_amount: r.amount, auto_amount: autoAmt,
      reason: reason || (source === 'import' ? '報表匯入' : ''), user_id: userId, user_name: name,
    }
  })
  for (let i = 0; i < logs.length; i += 1000) await admin.from('pnl_entry_logs').insert(logs.slice(i, i + 1000))

  return NextResponse.json({ ok: true, upserted: rows.length })
}

// DELETE /api/hr/pnl  改回自動值（刪除人工值），留痕
// body: { period, store_id, line_code, reason }
export async function DELETE(req: NextRequest) {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId, userId } = ctx

  const body = await req.json().catch(() => null)
  const period = String(body?.period ?? ''), storeId = String(body?.store_id ?? ''), line = String(body?.line_code ?? '')
  const reason = String(body?.reason ?? '').trim().slice(0, 500)
  if (!PERIOD_RE.test(period) || !storeId || !line) return NextResponse.json({ error: '參數不完整' }, { status: 400 })
  if (!reason) return NextResponse.json({ error: '請填寫修改原因' }, { status: 400 })

  const { data: old } = await admin.from('pnl_entries').select('id, amount')
    .eq('owner_id', ownerId).eq('store_id', storeId).eq('period', period).eq('line_code', line).maybeSingle()
  if (!old) return NextResponse.json({ ok: true, unchanged: true })

  const [{ stores, fin }, name] = await Promise.all([syncPnlStores(admin, ownerId), actorName(admin, userId)])
  const { values: auto } = await computeAutoPnl(admin, ownerId, stores, fin, period, period)
  const { error } = await admin.from('pnl_entries').delete().eq('id', old.id).eq('owner_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from('pnl_entry_logs').insert({
    owner_id: ownerId, store_id: storeId, period, line_code: line, action: 'revert',
    old_amount: Number(old.amount), new_amount: null, auto_amount: auto[period]?.[storeId]?.[line] ?? 0,
    reason, user_id: userId, user_name: name,
  })
  return NextResponse.json({ ok: true })
}
