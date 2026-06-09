import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsInbox } from './CsInbox'

export const dynamic = 'force-dynamic'

export default async function CsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  return <CsInbox initialIndustry={sp.industry ?? 'homestay'} />
}
