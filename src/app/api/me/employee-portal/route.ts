/** GET /api/me/employee-portal — 登入帳號綁定的員工專區入口（沒有綁定回 { url: null }） */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { companySlugForOwner } from '@/lib/company/fromHost'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ url: null }, { status: 401 })
  const admin = createAdminClient()
  const { data: emp } = await admin.from('hr_employees').select('owner_id, attendance_no')
    .eq('profile_id', user.id).eq('status', 'active').limit(1).maybeSingle()
  if (!emp?.attendance_no) return NextResponse.json({ url: null })
  const slug = await companySlugForOwner(emp.owner_id)
  return NextResponse.json({ url: slug ? `https://${slug}.im-tourist.com/api/e/sso` : null })
}
