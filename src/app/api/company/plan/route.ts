import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserCompany } from '@/lib/company/membership'
import { getCompanyEntitlements } from '@/lib/company/entitlements'

// GET /api/company/plan — 給公司方案頁用來顯示目前方案與權益
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '你目前不屬於任何公司' }, { status: 403 })

  const { plan, features } = await getCompanyEntitlements(supabase, company.companyId)
  return NextResponse.json({
    plan,
    features,
    companyName: company.name,
    isOwnerOrAdmin: company.role === 'owner' || company.role === 'admin',
  })
}
