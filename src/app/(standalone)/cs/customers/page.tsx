import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsCustomers } from './CsCustomers'

export const dynamic = 'force-dynamic'

export default async function CsCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  return <CsCustomers initialIndustry={sp.industry} />
}
