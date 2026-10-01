/**
 * GET  /api/marketing/company-data  — 讀取公司資料（即時由 mkt_brand / fin_stores / mkt_product_profiles 組成）
 * PUT  /api/marketing/company-data  — 更新公司基本資料（寫入 mkt_brand；門市、產品請至各自主檔維護）
 */
import { NextRequest, NextResponse } from 'next/server'
import { marketingCompany } from '@/lib/marketing/company'
import { currentDataOwner, loadCompanyProfile, PROFILE_TO_BRAND } from '@/lib/company/profile'

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [profile, { data: row }] = await Promise.all([
    loadCompanyProfile(c.admin, c.ownerId),
    c.admin.from('company_data').select('compiled_md').eq('user_id', c.ownerId).maybeSingle(),
  ])
  return NextResponse.json({ data: profile, compiled_md: row?.compiled_md ?? null })
}

export async function PUT(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))

  const upd: Record<string, unknown> = { owner_id: c.ownerId, updated_at: new Date().toISOString() }
  for (const [k, col] of Object.entries(PROFILE_TO_BRAND)) {
    if (body[k] !== undefined) upd[col] = String(body[k] ?? '').trim()
  }
  if (Array.isArray(body.files)) upd.files = body.files
  if (body.website !== undefined) {
    const { data: cur } = await c.admin.from('mkt_brand').select('platforms').eq('owner_id', c.ownerId).maybeSingle()
    upd.platforms = { ...((cur?.platforms as object) ?? {}), website: String(body.website ?? '').trim() }
  }

  const { error } = await c.admin.from('mkt_brand').upsert(upd, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
