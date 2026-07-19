import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CsWorkspace } from './CsWorkspace'

const CS_TABS = ['platforms', 'ai-settings', 'dialogue-files', 'data-sources', 'pricing', 'test', 'logs', 'tickets', 'inbox'] as const
type CsTab = typeof CS_TABS[number]

export default async function CsWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const initialTab = CS_TABS.includes(sp.tab as CsTab) ? (sp.tab as CsTab) : undefined
  return <CsWorkspace industry={sp.industry} initialTab={initialTab} />
}
