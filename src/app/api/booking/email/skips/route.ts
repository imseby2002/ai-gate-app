import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

// 最近被略過/擷取失敗的訂單信件，供「Email 同步」頁面顯示，方便追查漏單原因。
export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: skips } = await supabase
    .from('email_sync_skips')
    .select('id, platform, subject, from_address, reason, detail, created_at')
    .eq('user_id', ctx.ownerId)
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ skips: skips ?? [] })
}
