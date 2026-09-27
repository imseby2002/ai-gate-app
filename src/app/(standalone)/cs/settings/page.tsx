import { getBnbContext } from '@/lib/bnb/context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CsChannels } from './CsChannels'

export const dynamic = 'force-dynamic'

export default async function CsChannelsPage() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/booking')

  // 頻道憑證一律存在 ownerId 名下（/api/social/credentials）；負責人與管理員（IT）皆可設定。
  return <CsChannels ownerId={ctx.ownerId} canSettings={ctx.canSettings} />
}
