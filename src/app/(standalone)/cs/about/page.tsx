import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsAbout } from '../CsAbout'

export default async function CsAboutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CsAbout />
}
