import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IvrManager } from './IvrManager'

export const dynamic = 'force-dynamic'

export default async function IvrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <IvrManager />
}
