import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing', 'rd', 'store'])
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const sp = new URL(req.url).searchParams
  const launchId = sp.get('launch_id')
  if (!launchId) return NextResponse.json({ error: 'launch_id required' }, { status: 400 })

  const { data: launch, error: launchErr } = await c.admin
    .from('mkt_product_launches')
    .select('*')
    .eq('id', launchId)
    .eq('owner_id', c.ownerId)
    .single()

  if (launchErr || !launch) return NextResponse.json({ error: '找不到該新品發布紀錄' }, { status: 404 })

  const productName = launch.name.trim().toLowerCase()
  const vipStart = launch.vip_start_date ? new Date(launch.vip_start_date + 'T00:00:00Z') : null
  const vipEnd = launch.vip_end_date ? new Date(launch.vip_end_date + 'T23:59:59.999Z') : null
  const now = new Date()

  // 1. VIP 專享期業績
  let vipStats = {
    days: 0,
    cups: 0,
    revenue: 0,
    orders: 0,
    dailyAvgCups: 0,
    dailyAvgRevenue: 0,
    vipCustomerCount: 0,
  }

  if (vipStart && vipEnd) {
    const diffTime = Math.max(1, vipEnd.getTime() - vipStart.getTime())
    vipStats.days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))

    const { data: orders } = await c.admin
      .from('pos_orders')
      .select('id, items, total_cents, created_at, status')
      .eq('owner_id', c.ownerId)
      .eq('status', 'done')
      .gte('created_at', vipStart.toISOString())
      .lte('created_at', vipEnd.toISOString())

    for (const ord of orders ?? []) {
      const items = Array.isArray(ord.items) ? ord.items : []
      let matchedInOrder = false
      for (const item of items) {
        const itemName = String(item.name || '').trim().toLowerCase()
        if (itemName.includes(productName) || productName.includes(itemName)) {
          const qty = Number(item.quantity || item.qty) || 1
          const price = Number(item.price || item.unit_price) || 0
          vipStats.cups += qty
          vipStats.revenue += price * qty
          matchedInOrder = true
        }
      }
      if (matchedInOrder) {
        vipStats.orders += 1
      }
    }

    vipStats.dailyAvgCups = Math.round((vipStats.cups / vipStats.days) * 10) / 10
    vipStats.dailyAvgRevenue = Math.round(vipStats.revenue / vipStats.days)
  }

  // 2. 全客開放期業績 (自 vipEnd 隔天起算至今日)
  let publicStats = {
    days: 0,
    cups: 0,
    revenue: 0,
    orders: 0,
    dailyAvgCups: 0,
    dailyAvgRevenue: 0,
  }

  if (vipEnd && now.getTime() > vipEnd.getTime()) {
    const pubStart = new Date(vipEnd.getTime() + 1000)
    const pubDiff = Math.max(1, now.getTime() - pubStart.getTime())
    publicStats.days = Math.max(1, Math.ceil(pubDiff / (1000 * 60 * 60 * 24)))

    const { data: pubOrders } = await c.admin
      .from('pos_orders')
      .select('id, items, total_cents, created_at, status')
      .eq('owner_id', c.ownerId)
      .eq('status', 'done')
      .gte('created_at', pubStart.toISOString())
      .lte('created_at', now.toISOString())

    for (const ord of pubOrders ?? []) {
      const items = Array.isArray(ord.items) ? ord.items : []
      let matchedInOrder = false
      for (const item of items) {
        const itemName = String(item.name || '').trim().toLowerCase()
        if (itemName.includes(productName) || productName.includes(itemName)) {
          const qty = Number(item.quantity || item.qty) || 1
          const price = Number(item.price || item.unit_price) || 0
          publicStats.cups += qty
          publicStats.revenue += price * qty
          matchedInOrder = true
        }
      }
      if (matchedInOrder) {
        publicStats.orders += 1
      }
    }

    publicStats.dailyAvgCups = Math.round((publicStats.cups / publicStats.days) * 10) / 10
    publicStats.dailyAvgRevenue = Math.round(publicStats.revenue / publicStats.days)
  }

  // 3. 效益比對與分析
  const cupsLiftPct = vipStats.dailyAvgCups > 0
    ? Math.round(((publicStats.dailyAvgCups - vipStats.dailyAvgCups) / vipStats.dailyAvgCups) * 100)
    : 0

  const revLiftPct = vipStats.dailyAvgRevenue > 0
    ? Math.round(((publicStats.dailyAvgRevenue - vipStats.dailyAvgRevenue) / vipStats.dailyAvgRevenue) * 100)
    : 0

  return NextResponse.json({
    ok: true,
    launch,
    vipPeriod: {
      startDate: launch.vip_start_date,
      endDate: launch.vip_end_date,
      ...vipStats,
    },
    publicPeriod: {
      startDate: launch.vip_end_date,
      endDate: formatDate(now),
      ...publicStats,
    },
    comparison: {
      cupsLiftPct,
      revLiftPct,
      analysis: publicStats.dailyAvgCups > vipStats.dailyAvgCups
        ? `全面開放後日均銷量大幅躍升 ${cupsLiftPct}%！顯示 VIP 搶先試飲階段成功積累口碑熱度，有效引爆大眾市場。`
        : '全面開放後銷量維持穩定，建議配合第二波社群短影音與外送平台主打進一步擴大受眾。',
    },
  })
}
