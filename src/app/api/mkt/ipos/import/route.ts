import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing', 'store'])
}

const s = (v: unknown) => String(v ?? '').trim()

function parseDateStr(val: unknown): string {
  if (!val) return ''
  const str = String(val).trim()
  // YYYY-MM-DD or YYYY/MM/DD
  const m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const m2 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m2) {
    return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`
  }
  return str.slice(0, 10)
}

function parseNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  const cleaned = String(val).replace(/[$NTNT$¥₫,\s]/gi, '').trim()
  const n = Number(cleaned)
  return isNaN(n) ? fallback : n
}

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  // 1. 取得近期匯入與同步紀錄
  const { data: logs, error: logsErr } = await c.admin
    .from('mkt_integration_sync_logs')
    .select('*')
    .eq('owner_id', c.ownerId)
    .eq('system_type', 'ipos')
    .order('created_at', { ascending: false })
    .limit(10)

  // 2. 統計目前已匯入之 iPOS 總數據概況
  const { data: salesStats } = await c.admin
    .from('ipos_daily_sales')
    .select('sales_date, revenue, store')
    .eq('owner_id', c.ownerId)

  const totalRecords = salesStats?.length ?? 0
  let totalRevenue = 0
  let minDate = ''
  let maxDate = ''
  const storesSet = new Set<string>()

  if (salesStats && salesStats.length > 0) {
    for (const r of salesStats) {
      totalRevenue += Number(r.revenue) || 0
      if (r.store) storesSet.add(r.store)
      if (!minDate || r.sales_date < minDate) minDate = r.sales_date
      if (!maxDate || r.sales_date > maxDate) maxDate = r.sales_date
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalRecords,
      totalRevenue: Math.round(totalRevenue),
      minDate,
      maxDate,
      storeCount: storesSet.size,
      stores: Array.from(storesSet),
    },
    recentLogs: logs ?? [],
  })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const rawRows: Record<string, unknown>[] = Array.isArray(b.rows) ? b.rows : []
  const filename = s(b.filename) || 'ipos_sales.xlsx'

  if (rawRows.length === 0) {
    return NextResponse.json({ error: '請提供欲匯入之銷售紀錄列 (rows)' }, { status: 400 })
  }

  const batchId = `batch_${Date.now()}`
  const validRows: any[] = []
  const errors: { line: number; message: string }[] = []
  let totalBatchRevenue = 0

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]
    const salesDate = parseDateStr(r.sales_date || r.date || r.銷售日期 || r.日期)
    if (!salesDate || salesDate.length < 8) {
      errors.push({ line: i + 1, message: '日期格式不正確或為空' })
      continue
    }

    const revenue = parseNum(r.revenue || r.營業額 || r.營收 || r.金額 || r.總額 || r.total, 0)
    const orderCount = parseNum(r.order_count || r.orders || r.訂單數 || r.單數, 0)
    const cupsSold = parseNum(r.cups_sold || r.cups || r.杯數 || r.數量 || r.qty, 0)
    const store = s(r.store || r.門市 || r.分店 || r.門市名稱) || '全門市'
    const productName = s(r.product_name || r.品名 || r.商品名稱 || r.商品 || '')
    const productCode = s(r.product_code || r.商品代碼 || r.條碼 || '')
    const category = s(r.category || r.類別 || r.分類 || '')

    totalBatchRevenue += revenue

    validRows.push({
      owner_id: c.ownerId,
      sales_date: salesDate,
      store,
      revenue,
      order_count: orderCount,
      cups_sold: cupsSold,
      product_name: productName,
      product_code: productCode,
      category,
      source: 'ipos_upload',
      batch_id: batchId,
      updated_at: new Date().toISOString(),
    })
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      error: '無有效銷售資料列可寫入，請確認日期與金額欄位是否正確',
      errors,
    }, { status: 400 })
  }

  // 分批寫入 (Supabase upsert 建議每次最多 500 筆)
  const CHUNK_SIZE = 500
  let upsertedCount = 0

  for (let idx = 0; idx < validRows.length; idx += CHUNK_SIZE) {
    const chunk = validRows.slice(idx, idx + CHUNK_SIZE)
    const { data, error } = await c.admin
      .from('ipos_daily_sales')
      .upsert(chunk, { onConflict: 'owner_id,store,sales_date,product_name' })
      .select('id')

    if (error) {
      // 記錄失敗日誌
      await c.admin.from('mkt_integration_sync_logs').insert({
        owner_id: c.ownerId,
        system_type: 'ipos',
        sync_type: 'upload',
        status: 'failed',
        filename,
        records_count: validRows.length,
        error_message: error.message,
      })
      return NextResponse.json({ error: `寫入資料庫失敗: ${error.message}` }, { status: 500 })
    }
    upsertedCount += data?.length ?? chunk.length
  }

  // 寫入成功同步日誌
  await c.admin.from('mkt_integration_sync_logs').insert({
    owner_id: c.ownerId,
    system_type: 'ipos',
    sync_type: 'upload',
    status: 'success',
    filename,
    records_count: validRows.length,
    total_revenue: totalBatchRevenue,
    meta: {
      batch_id: batchId,
      first_date: validRows[0]?.sales_date,
      last_date: validRows[validRows.length - 1]?.sales_date,
    },
  })

  return NextResponse.json({
    ok: true,
    inserted: upsertedCount,
    updated: upsertedCount,
    imported: upsertedCount,
    skipped: errors.length,
    totalRevenue: totalBatchRevenue,
    errors,
  })
}
