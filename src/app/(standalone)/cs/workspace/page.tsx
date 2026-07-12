import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsWorkspace } from './CsWorkspace'

export default async function CsWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  return <CsWorkspace industry={sp.industry} />
}
