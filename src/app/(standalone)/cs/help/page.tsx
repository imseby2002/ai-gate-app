import { getBnbContext } from '@/lib/bnb/context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CsHelp } from './CsHelp'

export const dynamic = 'force-dynamic'

export default async function CsHelpPage() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/booking')

  return <CsHelp />
}
