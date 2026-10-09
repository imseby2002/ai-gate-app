import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChannelAccountsPage } from './ChannelAccountsPage'

export const dynamic = 'force-dynamic'

export default async function CompanyChannels() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ChannelAccountsPage />
}
