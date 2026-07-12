import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { CsPlanPage } from './CsPlanPage'

export const dynamic = 'force-dynamic'

export default async function CsPlan() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/booking')

  return <CsPlanPage isOwner={ctx.isOwner} />
}
