// 行銷成效彙整：外送渠道營收、行銷支出（實體預算＋損益廣告費）、內容產出量，並對照全公司營業額。
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export interface MktSnapshot {
  delivery: { byPlatform: { platform: string; orders: number; revenue: number; count: number; online: number }[]; totalOrders: number; totalRevenue: number }
  offline: { spend: number; active: number; byType: { type: string; count: number; spend: number }[] }
  content: { total: number; review: number; published: number }
  pnl: { period: string; revenue: number; advertising: number } | null
  spend_total: number          // 實體行銷預算 + 損益廣告費
  delivery_share: number | null // 外送營收 / 全公司營業額
}

export async function buildMktSnapshot(admin: Admin, ownerId: string): Promise<MktSnapshot> {
  const [{ data: deliv }, { data: offline }, { count: contentTotal }, { count: contentReview }, { count: published }] = await Promise.all([
    admin.from('mkt_delivery').select('platform, status, monthly_orders, monthly_revenue').eq('owner_id', ownerId),
    admin.from('mkt_offline').select('type, budget, status').eq('owner_id', ownerId),
    admin.from('mkt_content').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    admin.from('mkt_content').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'review'),
    admin.from('mkt_calendar').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'published'),
  ])

  // 外送：依平台彙總
  const pMap: Record<string, { orders: number; revenue: number; count: number; online: number }> = {}
  for (const d of deliv ?? []) {
    const p = (pMap[d.platform as string] ??= { orders: 0, revenue: 0, count: 0, online: 0 })
    p.orders += Number(d.monthly_orders) || 0
    p.revenue += Number(d.monthly_revenue) || 0
    p.count += 1
    if (d.status === 'online') p.online += 1
  }
  const byPlatform = Object.entries(pMap).map(([platform, v]) => ({ platform, ...v })).sort((a, b) => b.revenue - a.revenue)
  const totalOrders = byPlatform.reduce((t, p) => t + p.orders, 0)
  const totalRevenue = byPlatform.reduce((t, p) => t + p.revenue, 0)

  // 實體行銷支出
  const tMap: Record<string, { count: number; spend: number }> = {}
  let offlineSpend = 0, offlineActive = 0
  for (const o of offline ?? []) {
    const t = (tMap[o.type as string] ??= { count: 0, spend: 0 })
    t.count += 1; t.spend += Number(o.budget) || 0
    offlineSpend += Number(o.budget) || 0
    if (o.status !== 'cancelled' && o.status !== 'done') offlineActive += 1
  }
  const byType = Object.entries(tMap).map(([type, v]) => ({ type, ...v }))

  // 損益：最新期間營業額與廣告費
  const { data: periods } = await admin.from('pnl_entries').select('period').eq('owner_id', ownerId).order('period', { ascending: false }).limit(1)
  const period = periods?.[0]?.period ?? ''
  let pnl: MktSnapshot['pnl'] = null
  if (period) {
    const { data: rows } = await admin.from('pnl_entries').select('line_code, amount').eq('owner_id', ownerId).eq('period', period).in('line_code', ['revenue', 'advertising'])
    let revenue = 0, advertising = 0
    for (const r of rows ?? []) {
      if (r.line_code === 'revenue') revenue += Number(r.amount) || 0
      else if (r.line_code === 'advertising') advertising += Number(r.amount) || 0
    }
    pnl = { period, revenue, advertising }
  }

  const spend_total = offlineSpend + (pnl?.advertising ?? 0)
  const delivery_share = pnl && pnl.revenue ? totalRevenue / pnl.revenue : null

  return {
    delivery: { byPlatform, totalOrders, totalRevenue },
    offline: { spend: offlineSpend, active: offlineActive, byType },
    content: { total: contentTotal ?? 0, review: contentReview ?? 0, published: published ?? 0 },
    pnl,
    spend_total,
    delivery_share,
  }
}
