import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_BNB_COOKIE } from '@/lib/bnb/context'

async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 切換目前要管理哪一間民宿
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId } = await req.json()
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, ...(domain ? { domain } : {}) }

  // 切回自己
  if (!ownerId || ownerId === user.id) {
    cookieStore.set(ACTIVE_BNB_COOKIE, '', { ...opts, maxAge: 0 })
    return NextResponse.json({ ownerId: user.id, role: 'owner' })
  }

  // 驗證對該 owner 有 active membership
  const { data: member } = await supabase
    .from('bnb_members')
    .select('role')
    .eq('owner_id', ownerId)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!member) return NextResponse.json({ error: '無權管理此民宿' }, { status: 403 })

  cookieStore.set(ACTIVE_BNB_COOKIE, ownerId, opts)
  return NextResponse.json({ ownerId, role: member.role })
}
