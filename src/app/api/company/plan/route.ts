import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'
import { getCompanyEntitlements } from '@/lib/company/entitlements'
import { calcCompanyMonthlyPrice } from '@/lib/company/pricing'

// GET /api/company/plan — 給公司方案頁用來顯示目前方案、平台開通內容與計價明細
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '你目前不屬於任何公司' }, { status: 403 })

  const { plan, features } = await getCompanyEntitlements(supabase, company.companyId)

  // 開通內容由平台在 admin 後台設定；這裡只讀取並試算價格
  const admin = createAdminClient()
  const [{ data: companyRow }, { data: sub }] = await Promise.all([
    admin.from('companies').select('enabled_modules').eq('id', company.companyId).single(),
    admin.from('company_subscriptions').select('erp_seats, retail_stores, custom_domain, current_period_end').eq('company_id', company.companyId).maybeSingle(),
  ])
  const config = {
    modules: companyRow?.enabled_modules ?? [],
    erpSeats: sub?.erp_seats ?? 0,
    retailStores: sub?.retail_stores ?? 0,
    customDomain: sub?.custom_domain ?? false,
  }

  return NextResponse.json({
    plan,
    features,
    companyName: company.name,
    isOwnerOrAdmin: company.role === 'owner' || company.role === 'admin',
    currentPeriodEnd: sub?.current_period_end ?? null,
    config,
    price: calcCompanyMonthlyPrice(config),
  })
}
