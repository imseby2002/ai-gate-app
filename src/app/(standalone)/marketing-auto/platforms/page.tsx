import { getBnbContext } from '@/lib/bnb/context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketingPlatforms } from './MarketingPlatforms'

export const dynamic = 'force-dynamic'

export default async function MarketingPlatformsPage() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/marketing-auto')

  return <MarketingPlatforms isOwner={ctx.isOwner} />
}
