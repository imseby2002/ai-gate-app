import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing', 'store'])
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d)
  res.setDate(res.getDate() + days)
  return res
}

function subYears(d: Date, years: number): Date {
  const res = new Date(d)
  res.setFullYear(res.getFullYear() - years)
  return res
}

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const sp = new URL(req.url).searchParams
  const campaignId = sp.get('campaign_id')

  let startDateStr = sp.get('start_date')
  let endDateStr = sp.get('end_date')
  let storeFilter = sp.get('store') || ''
  let budget = Number(sp.get('budget')) || 0
  let targetProducts: string[] = []

  let campaignTitle = '活動業績分析'

  if (campaignId) {
    const { data: campaign } = await c.admin
      .from('mkt_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('owner_id', c.ownerId)
      .maybeSingle()

    if (campaign) {
      campaignTitle = campaign.title
      startDateStr = campaign.start_date
      endDateStr = campaign.end_date
      storeFilter = campaign.store || storeFilter
      budget = Number(campaign.actual_spend || campaign.budget) || budget
      targetProducts = Array.isArray(campaign.target_products) ? campaign.target_products : []
    }
  }

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: '需提供 start_date 與 end_date 或有效的 campaign_id' }, { status: 400 })
  }

  const startDate = new Date(startDateStr + 'T00:00:00Z')
  const endDate = new Date(endDateStr + 'T23:59:59.999Z')
  const now = new Date()

  // 計算活動天數 N
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))

  // 1. 前期區間 (PoP): 活動前等長的 N 天
  const priorEndDate = addDays(startDate, -1)
  priorEndDate.setUTCHours(23, 59, 59, 999)
  const priorStartDate = addDays(priorEndDate, -(diffDays - 1))
  priorStartDate.setUTCHours(0, 0, 0, 0)

  // 2. 去年同期區間 (YoY): 去年的同月同日
  const yoyStartDate = subYears(startDate, 1)
  const yoyEndDate = subYears(endDate, 1)

  // 3. 活動後延燒區間 (Post-Campaign): 活動結束後 N 天 (最多至今日)
  const postStartDate = addDays(endDate, 1)
  postStartDate.setUTCHours(0, 0, 0, 0)
  const postDays = Math.min(diffDays, 14) // 預設追蹤 7~14 天
  const postEndDate = addDays(postStartDate, postDays - 1)
  postEndDate.setUTCHours(23, 59, 59, 999)
  const hasEnded = endDate.getTime() < now.getTime()

  // 輔助函式：自 ipos_daily_sales 與 pos_orders 統計指定區間業績
  async function computePeriodMetrics(from: Date, to: Date) {
    const fromStr = formatDate(from)
    const toStr = formatDate(to)

    // 1. 查詢 iPOS 匯入之每日/每品項營業額紀錄
    let iposQuery = c.admin
      .from('ipos_daily_sales')
      .select('sales_date, store, revenue, order_count, cups_sold, product_name, category')
      .eq('owner_id', c.ownerId)
      .gte('sales_date', fromStr)
      .lte('sales_date', toStr)

    if (storeFilter && storeFilter !== '全門市') {
      iposQuery = iposQuery.ilike('store', `%${storeFilter}%`)
    }

    const { data: iposRows, error: iposErr } = await iposQuery
    if (iposErr) {
      console.warn('ipos_daily_sales query error:', iposErr.message)
    }

    // 2. 查詢 POS 即時單據 (如有)
    let posQuery = c.admin
      .from('pos_orders')
      .select('id, total_cents, items, status, created_at, store_id')
      .eq('owner_id', c.ownerId)
      .eq('status', 'done')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    const { data: orders, error: posErr } = await posQuery
    if (posErr) {
      console.warn('pos_orders query error:', posErr.message)
    }

    const orderRows = orders ?? []
    const iposData = iposRows ?? []

    let totalRevenue = 0
    let totalOrders = 0
    let totalCups = 0
    let targetProductRevenue = 0
    let targetProductCups = 0

    // 日期分布 map
    const dailyMap: Record<string, { date: string; revenue: number; orders: number; cups: number }> = {}

    // A. 彙總 iPOS 匯入之業績
    for (const row of iposData) {
      const rev = Number(row.revenue) || 0
      const ords = Number(row.order_count) || 0
      const cups = Number(row.cups_sold) || 0

      totalRevenue += rev
      totalOrders += ords
      totalCups += cups

      const dayKey = row.sales_date
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, revenue: 0, orders: 0, cups: 0 }
      }
      dailyMap[dayKey].revenue += rev
      dailyMap[dayKey].orders += ords
      dailyMap[dayKey].cups += cups

      if (targetProducts.length > 0 && row.product_name) {
        const pName = String(row.product_name).toLowerCase()
        if (targetProducts.some(p => pName.includes(String(p).trim().toLowerCase()))) {
          targetProductRevenue += rev
          targetProductCups += cups
        }
      }
    }

    // B. 彙總 POS 訂單 (若無 iPOS 資料或作為即時補充)
    for (const ord of orderRows) {
      const rev = (ord.total_cents || 0) / 100
      totalRevenue += rev
      totalOrders += 1

      const dayKey = ord.created_at.split('T')[0]
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, revenue: 0, orders: 0, cups: 0 }
      }
      dailyMap[dayKey].revenue += rev
      dailyMap[dayKey].orders += 1

      const items = Array.isArray(ord.items) ? ord.items : []
      for (const item of items) {
        const qty = Number(item.quantity || item.qty) || 1
        const price = Number(item.price || item.unit_price) || 0
        totalCups += qty
        dailyMap[dayKey].cups += qty

        if (targetProducts.length > 0) {
          const itemName = String(item.name || '').trim().toLowerCase()
          if (targetProducts.some(p => itemName.includes(String(p).trim().toLowerCase()))) {
            targetProductRevenue += price * qty
            targetProductCups += qty
          }
        }
      }
    }

    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    return {
      revenue: Math.round(totalRevenue),
      orders: totalOrders,
      cups: totalCups,
      aov,
      targetProductRevenue: Math.round(targetProductRevenue),
      targetProductCups,
      daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  // 同時抓取四大區間
  const [current, prior, yoy, post] = await Promise.all([
    computePeriodMetrics(startDate, endDate),
    computePeriodMetrics(priorStartDate, priorEndDate),
    computePeriodMetrics(yoyStartDate, yoyEndDate),
    hasEnded ? computePeriodMetrics(postStartDate, postEndDate) : Promise.resolve(null),
  ])

  // 前期成長率 (PoP)
  const popRevGrowth = prior.revenue > 0 ? ((current.revenue - prior.revenue) / prior.revenue) * 100 : (current.revenue > 0 ? 100 : 0)
  const popOrdersGrowth = prior.orders > 0 ? ((current.orders - prior.orders) / prior.orders) * 100 : (current.orders > 0 ? 100 : 0)
  const popCupsGrowth = prior.cups > 0 ? ((current.cups - prior.cups) / prior.cups) * 100 : (current.cups > 0 ? 100 : 0)

  // 去年同期成長率 (YoY)
  const yoyRevGrowth = yoy.revenue > 0 ? ((current.revenue - yoy.revenue) / yoy.revenue) * 100 : (current.revenue > 0 ? 100 : 0)
  const yoyOrdersGrowth = yoy.orders > 0 ? ((current.orders - yoy.orders) / yoy.orders) * 100 : (current.orders > 0 ? 100 : 0)

  // 活動後延燒效應 (Post vs Current vs Prior)
  let postAnalysis = null
  if (post && post.orders > 0) {
    const postDailyAvgRev = Math.round(post.revenue / postDays)
    const currentDailyAvgRev = Math.round(current.revenue / diffDays)
    const priorDailyAvgRev = Math.round(prior.revenue / diffDays)
    const postVsPriorGrowth = priorDailyAvgRev > 0 ? ((postDailyAvgRev - priorDailyAvgRev) / priorDailyAvgRev) * 100 : 0

    postAnalysis = {
      ...post,
      days: postDays,
      dailyAvgRevenue: postDailyAvgRev,
      postVsPriorGrowth: Math.round(postVsPriorGrowth * 10) / 10,
      sustained: postDailyAvgRev > priorDailyAvgRev,
      comment: postDailyAvgRev > priorDailyAvgRev
        ? '活動結束後仍維持顯著長尾拉力，日均營收高於活動前基準線！'
        : '活動結束後買氣迅速回落，建議搭配會員回流券深化留存。',
    }
  }

  // 投資回報率 (ROI)
  const incrementalRevenue = Math.max(0, current.revenue - prior.revenue)
  // 以手搖茶飲行業平均毛利率 65% 估算活動實質毛利增量
  const estimatedGrossProfit = Math.round(incrementalRevenue * 0.65)
  const roi = budget > 0 ? Math.round(((estimatedGrossProfit - budget) / budget) * 100) : (incrementalRevenue > 0 ? 100 : 0)

  return NextResponse.json({
    ok: true,
    campaignTitle,
    summary: {
      diffDays,
      budget,
      currentPeriod: {
        from: formatDate(startDate),
        to: formatDate(endDate),
        ...current,
      },
      priorPeriod: {
        from: formatDate(priorStartDate),
        to: formatDate(priorEndDate),
        ...prior,
      },
      yoyPeriod: {
        from: formatDate(yoyStartDate),
        to: formatDate(yoyEndDate),
        ...yoy,
      },
      growth: {
        popRevenueGrowthPct: Math.round(popRevGrowth * 10) / 10,
        popOrdersGrowthPct: Math.round(popOrdersGrowth * 10) / 10,
        popCupsGrowthPct: Math.round(popCupsGrowth * 10) / 10,
        yoyRevenueGrowthPct: Math.round(yoyRevGrowth * 10) / 10,
        yoyOrdersGrowthPct: Math.round(yoyOrdersGrowth * 10) / 10,
      },
      roi: {
        incrementalRevenue,
        estimatedGrossProfit,
        roiPct: roi,
      },
      postAnalysis,
    },
  })
}
