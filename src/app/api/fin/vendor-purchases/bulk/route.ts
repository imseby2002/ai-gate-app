import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getFinanceUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getFinanceUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { vendor_id, vendor_name, rows } = (await req.json()) as {
    vendor_id?: string
    vendor_name?: string
    rows?: Record<string, unknown>[]
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  // 如果沒有指定 vendor_id，抓取現有廠商列表來按名稱比對
  let vendorIdMap = new Map<string, string>()
  if (!vendor_id) {
    const { data: vendors } = await supabase
      .from('fin_vendors')
      .select('id, name')
      .eq('owner_id', user.id)
    vendorIdMap = new Map((vendors || []).map(v => [v.name.trim().toLowerCase(), v.id]))
  }

  const toInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const product = String(r.product ?? '').trim()
    const targetVendorId = vendor_id || vendorIdMap.get(String(r.vendor_name ?? vendor_name ?? '').trim().toLowerCase())

    if (!targetVendorId) {
      errors.push({ line, reason: `找不到指定廠商「${r.vendor_name || '未指定'}」` })
      continue
    }

    if (!product) {
      errors.push({ line, reason: '缺少產品名稱' })
      continue
    }

    const purchasedOn = r.purchased_on ? String(r.purchased_on).trim() : new Date().toISOString().slice(0, 10)

    toInsert.push({
      owner_id: user.id,
      vendor_id: targetVendorId,
      purchased_on: purchasedOn,
      product,
      qty: Number(r.qty) || 0,
      amount: Number(r.amount) || 0,
      note: String(r.note ?? r.notes ?? '').trim(),
    })
  }

  let inserted = 0
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('fin_vendor_purchases')
      .insert(toInsert)
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ ok: true, inserted, errors })
}
