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

// 依廠商服務別找對應費用科目（vendor_service = gas/ice）
async function findCategory(admin: Admin, ownerId: string, service: string) {
  const { data } = await admin.from('fin_expense_categories')
    .select('code, name').eq('owner_id', ownerId).eq('vendor_service', service).limit(1).single()
  return data
}

async function coveredStores(admin: Admin, ownerId: string, service: string, regions: string[]) {
  let q = admin.from('fin_stores').select('code, name, region').eq('owner_id', ownerId).eq('active', true)
  if (service === 'ice' && regions.length > 0) q = q.in('region', regions)
  const { data } = await q.order('region').order('code')
  return data ?? []
}

// 廠商以 token 讀取：自己涵蓋的門市 ＋ 該月已填金額
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
  if (cat) {
    const { data: bills } = await admin.from('fin_bills')
      .select('store_code, amount').eq('owner_id', v.owner_id).eq('year', year).eq('month', month).eq('category_code', cat.code)
    for (const b of bills ?? []) amounts[b.store_code] = Number(b.amount) || 0
  }
  return NextResponse.json({
    vendor: { name: v.name, service: v.service },
    category: cat ? { code: cat.code, name: cat.name } : null,
    year, month, stores, amounts,
  })
}

// 廠商送出：各門市金額 → 寫入 fin_bills(source='vendor')
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const v = await findVendor(admin, token)
  if (!v || !v.active) return NextResponse.json({ error: '連結無效或已停用' }, { status: 404 })
  const b = await req.json().catch(() => ({}))
  const year = parseInt(b.year) || new Date().getFullYear()
  const month = parseInt(b.month) || (new Date().getMonth() + 1)
  const amounts = (b.amounts ?? {}) as Record<string, unknown>

  const cat = await findCategory(admin, v.owner_id, v.service)
  if (!cat) return NextResponse.json({ error: '後台尚未設定對應費用科目' }, { status: 400 })
  const stores = await coveredStores(admin, v.owner_id, v.service, v.regions ?? [])
  const allowed = new Set(stores.map(s => s.code))

  const recs = Object.entries(amounts)
    .filter(([code]) => allowed.has(code))
    .map(([code, amt]) => ({
      owner_id: v.owner_id, store_code: code, year, month, category_code: cat.code,
      amount: Number(amt) || 0, source: 'vendor', vendor_id: v.id, updated_at: new Date().toISOString(),
    }))
  if (recs.length === 0) return NextResponse.json({ error: '沒有可送出的門市金額' }, { status: 400 })

  const { error } = await admin.from('fin_bills')
    .upsert(recs, { onConflict: 'owner_id,store_code,year,month,category_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = recs.reduce((s, r) => s + r.amount, 0)
  await notifyHR(v.owner_id, {
    kind: 'fin_vendor_bill',
    title: `🧾 ${v.name} 已填 ${year}/${month} ${cat.name}`,
    body: `${v.name}（${v.service === 'gas' ? '瓦斯' : '冰塊'}）已填報 ${recs.length} 家門市，合計 ${Math.round(total).toLocaleString('zh-TW')}。`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, saved: recs.length })
}
