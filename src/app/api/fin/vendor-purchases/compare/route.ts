import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { similarity, FUZZY_MATCH_THRESHOLD } from '@/lib/fin/fuzzy-match'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()

interface PurchaseRow {
  vendor_id: string
  product: string
  qty: number
  amount: number
  purchased_on: string
  fin_vendors: { name: string } | { name: string }[] | null
}

// 內部比價建議：以品項關鍵字模糊比對歷史採購紀錄，按廠商分組列出最新／最低／平均單價。
// 僅供內部參考，不代表正式報價，實際下單金額仍須向廠商確認。
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = s(new URL(req.url).searchParams.get('q'))
  if (!q) return NextResponse.json({ error: '請輸入要比價的品項關鍵字' }, { status: 400 })

  const { data, error } = await supabase.from('fin_vendor_purchases')
    .select('vendor_id, product, qty, amount, purchased_on, fin_vendors(name)')
    .eq('owner_id', user.id)
    .order('purchased_on', { ascending: false })
    .limit(3000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matched = ((data ?? []) as unknown as PurchaseRow[])
    .map(r => ({ ...r, score: similarity(q, r.product) }))
    .filter(r => r.score >= FUZZY_MATCH_THRESHOLD)

  const byVendor = new Map<string, { vendorName: string; rows: typeof matched }>()
  for (const r of matched) {
    const vendorName = Array.isArray(r.fin_vendors) ? (r.fin_vendors[0]?.name ?? '（未知廠商）') : (r.fin_vendors?.name ?? '（未知廠商）')
    const bucket = byVendor.get(r.vendor_id) ?? { vendorName, rows: [] }
    bucket.rows.push(r)
    byVendor.set(r.vendor_id, bucket)
  }

  const unitPrice = (r: { amount: number; qty: number }) => r.qty > 0 ? r.amount / r.qty : r.amount

  const results = [...byVendor.entries()].map(([vendorId, v]) => {
    const rows = v.rows.sort((a, b) => (a.purchased_on < b.purchased_on ? 1 : -1)) // 最新在前
    const prices = rows.map(unitPrice)
    const latest = rows[0]
    return {
      vendorId, vendorName: v.vendorName,
      matchCount: rows.length,
      bestMatchProduct: rows.reduce((best, r) => r.score > best.score ? r : best, rows[0]).product,
      latest: { product: latest.product, unitPrice: unitPrice(latest), qty: latest.qty, amount: latest.amount, purchasedOn: latest.purchased_on },
      minUnitPrice: Math.min(...prices),
      avgUnitPrice: prices.reduce((s, p) => s + p, 0) / prices.length,
    }
  }).sort((a, b) => a.latest.unitPrice - b.latest.unitPrice)

  return NextResponse.json({
    query: q,
    results,
    note: '以上為內部歷史採購紀錄的比價建議（品項為模糊比對，僅供參考），非正式報價，實際下單金額請向廠商確認。',
  })
}
