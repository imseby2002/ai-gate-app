import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyHR } from '@/lib/hr/notify'

type Ctx = { params: Promise<{ token: string }> }
type Admin = ReturnType<typeof createAdminClient>

async function findVendor(admin: Admin, token: string) {
  const { data } = await admin.from('fin_vendors')
    .select('id, owner_id, name, service, regions, active').eq('fill_token', token).single()
  return data
}

// 依廠商服務別找對應費用科目（vendor_service = electric/water/gas/ice）
async function findCategory(admin: Admin, ownerId: string, service: string) {
  let { data } = await admin.from('fin_expense_categories')
    .select('code, name').eq('owner_id', ownerId).eq('vendor_service', service).limit(1).single()

  if (!data) {
    const codeMap: Record<string, string[]> = {
      electric: ['ELEC', 'ELECTRIC'],
      water: ['WATER'],
      gas: ['GAS'],
      ice: ['ICE'],
    }
    const codes = codeMap[service] || []
    if (codes.length > 0) {
      const res = await admin.from('fin_expense_categories')
        .select('code, name').eq('owner_id', ownerId).in('code', codes).limit(1).single()
      data = res.data
    }
  }
  return data
}

async function coveredStores(admin: Admin, ownerId: string, service: string, regions: string[]) {
  let q = admin.from('fin_stores')
    .select('code, name, region, unit_type, electricity_no, water_no, address')
    .eq('owner_id', ownerId).eq('active', true)

  // 若廠商有指定負責區域（如瓦斯公司、冰塊廠商），僅取出該區域之門市／據點
  if (regions && regions.length > 0) {
    q = q.in('region', regions)
  }
  const { data } = await q.order('region').order('code')
  return data ?? []
}

// 廠商以 token 讀取：自己涵蓋的門市 ＋ 該月已填金額與單據
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const v = await findVendor(admin, token)
  if (!v || !v.active) return NextResponse.json({ error: '連結無效或已停用' }, { status: 404 })
  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)

  const cat = await findCategory(admin, v.owner_id, v.service)
  const stores = await coveredStores(admin, v.owner_id, v.service, v.regions ?? [])
  const amounts: Record<string, number> = {}
  const details: Record<string, { amount: number; receipt_url?: string; cylinders?: string; note?: string; source?: string }> = {}

  if (cat) {
    const { data: bills } = await admin.from('fin_bills')
      .select('store_code, amount, source, note, updated_at')
      .eq('owner_id', v.owner_id)
      .eq('year', year)
      .eq('month', month)
      .eq('category_code', cat.code)

    for (const b of bills ?? []) {
      const amt = Number(b.amount) || 0
      amounts[b.store_code] = amt
      let parsedNote = b.note || ''
      let receipt_url = ''
      let cylinders = ''
      try {
        const parsed = JSON.parse(b.note || '{}')
        if (parsed.receipt_url) receipt_url = parsed.receipt_url
        if (parsed.cylinders) cylinders = parsed.cylinders
        if (parsed.note) parsedNote = parsed.note
      } catch {}

      details[b.store_code] = {
        amount: amt,
        receipt_url,
        cylinders,
        note: parsedNote,
        source: b.source,
      }
    }
  }

  return NextResponse.json({
    vendor: { name: v.name, service: v.service, regions: v.regions },
    category: cat ? { code: cat.code, name: cat.name } : null,
    year,
    month,
    stores,
    amounts,
    details,
  })
}

// 廠商送出：各門市金額與單據發票照片 → 寫入 fin_bills(source='vendor')
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const v = await findVendor(admin, token)
  if (!v || !v.active) return NextResponse.json({ error: '連結無效或已停用' }, { status: 404 })
  const b = await req.json().catch(() => ({}))
  const year = parseInt(b.year) || new Date().getFullYear()
  const month = parseInt(b.month) || (new Date().getMonth() + 1)
  const amounts = (b.amounts ?? {}) as Record<string, unknown>
  const details = (b.details ?? {}) as Record<string, { receipt_url?: string; cylinders?: string; note?: string }>
  const masterReceiptUrl = String(b.master_receipt_url ?? '').trim()

  const cat = await findCategory(admin, v.owner_id, v.service)
  if (!cat) return NextResponse.json({ error: '後台尚未設定對應費用科目' }, { status: 400 })
  const stores = await coveredStores(admin, v.owner_id, v.service, v.regions ?? [])
  const allowed = new Set(stores.map(s => s.code))

  const recs = Object.entries(amounts)
    .filter(([code]) => allowed.has(code))
    .map(([code, amt]) => {
      const dt = details[code] || {}
      const notePayload = JSON.stringify({
        receipt_url: dt.receipt_url || masterReceiptUrl || '',
        cylinders: dt.cylinders || '',
        note: dt.note || '',
        submitted_by: v.name,
        vendor_service: v.service,
        submitted_at: new Date().toISOString(),
      })

      return {
        owner_id: v.owner_id,
        store_code: code,
        year,
        month,
        category_code: cat.code,
        amount: Number(amt) || 0,
        source: 'vendor',
        vendor_id: v.id,
        note: notePayload,
        updated_at: new Date().toISOString(),
      }
    })

  if (recs.length === 0) return NextResponse.json({ error: '沒有可送出的門市金額' }, { status: 400 })

  const { error } = await admin.from('fin_bills')
    .upsert(recs, { onConflict: 'owner_id,store_code,year,month,category_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = recs.reduce((s, r) => s + r.amount, 0)
  const serviceLabelMap: Record<string, string> = {
    gas: '瓦斯',
    electric: '電力',
    water: '自來水',
    ice: '冰塊',
  }
  const svcName = serviceLabelMap[v.service] || v.service || '外部公用事業/廠商'

  await notifyHR(v.owner_id, {
    kind: 'fin_vendor_bill',
    title: `🧾 ${v.name} 已填報 ${year}/${month} ${cat.name}`,
    body: `${v.name}（${svcName}）已填報 ${recs.length} 家門市/據點，合計 ${Math.round(total).toLocaleString('zh-TW')} VND。單據已自動匯入出納總務！`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, saved: recs.length })
}
