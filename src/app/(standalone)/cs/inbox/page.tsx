import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsInbox } from './CsInbox'

export const dynamic = 'force-dynamic'

export default async function CsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; platform?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  return (
    <CsInbox
      initialIndustry={sp.industry ?? 'homestay'}
      initialTarget={sp.platform && sp.to ? { platform: sp.platform, from_id: sp.to } : null}
    />
  )
}
