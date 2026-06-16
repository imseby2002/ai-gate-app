import { getBnbContext } from '@/lib/bnb/context'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CsChannels } from './CsChannels'

export const dynamic = 'force-dynamic'

export default async function CsChannelsPage() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) redirect('/booking')

  // 頻道憑證以登入者 user.id 為鍵儲存（/api/social/credentials），
  // 而客服送訊讀的是 ownerId；唯有擁有者本人綁定時兩者一致才會生效。
  return <CsChannels ownerId={ctx.ownerId} isOwner={ctx.isOwner} />
}
