import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { syncPnlStores, computeAutoPnl } from '@/lib/finance/pnl-auto'

// GET /api/hr/pnl/detail?period=YYYY-MM&store_id=…&line_code=…
// 單一格的來源明細（出納／薪資／門市費用）、目前人工值、修改紀錄
export async function GET(req: NextRequest) {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId } = ctx
  const sp = req.nextUrl.searchParams
  const period = sp.get('period') ?? '', storeId = sp.get('store_id') ?? '', line = sp.get('line_code') ?? ''
  if (!/^\d{4}-\d{2}$/.test(period) || !storeId || !line) return NextResponse.json({ error: '參數不完整' }, { status: 400 })

  try {
    const { stores, fin } = await syncPnlStores(admin, ownerId)
    if (!stores.some(s => s.id === storeId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const [{ values, contributions }, { data: entry }, { data: logs }] = await Promise.all([
      computeAutoPnl(admin, ownerId, stores, fin, period, period, { period, storeId, line }),
      admin.from('pnl_entries').select('amount, source, updated_at')
        .eq('owner_id', ownerId).eq('store_id', storeId).eq('period', period).eq('line_code', line).maybeSingle(),
      admin.from('pnl_entry_logs').select('action, old_amount, new_amount, auto_amount, reason, user_name, created_at')
        .eq('owner_id', ownerId).eq('store_id', storeId).eq('period', period).eq('line_code', line)
        .order('created_at', { ascending: false }).limit(100),
    ])
    contributions.sort((a, b) => b.amount - a.amount)
    return NextResponse.json({
      auto: values[period]?.[storeId]?.[line] ?? 0,
      entry: entry ?? null,
      contributions: contributions.slice(0, 300),
      contributionCount: contributions.length,
      logs: logs ?? [],
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
