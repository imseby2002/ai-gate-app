import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCompany } from '@/lib/company/membership'
import { CompanyPlanPage } from './CompanyPlanPage'

export const dynamic = 'force-dynamic'

export default async function CompanyPlan() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const company = await getUserCompany(user.id)
  if (!company) redirect('/apps')

  return <CompanyPlanPage isOwnerOrAdmin={company.role === 'owner' || company.role === 'admin'} />
}
