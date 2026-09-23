import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { activeBnbCookieName, type BnbScope } from '@/lib/bnb/context'

async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 切換目前要管理哪一間民宿的訂房或客服（兩者獨立，各自一顆 cookie，互不牽動；
// 也不連動「目前操作身分」的公司 cookie——這裡是單獨受邀的協作，不代表換了公司身分）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ownerId, scope } = await req.json() as { ownerId?: string; scope?: BnbScope }
  const s: BnbScope = scope === 'cs' ? 'cs' : 'booking'
  const cookieName = activeBnbCookieName(s)
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 365, ...(domain ? { domain } : {}) }

  // 切回自己：明確指回自己（不能只清掉——清掉會落到 getBnbContext 的「純協作者自動
  // 判定」，如果你剛好是別人的協作者又沒有自己的房源，會被悄悄帶回那個業務）。
  if (!ownerId || ownerId === user.id) {
    cookieStore.set(cookieName, user.id, opts)
    return NextResponse.json({ ownerId: user.id, role: 'owner' })
  }

  // 總管理員代操：admin 可切換到任何 owner（不需 membership），用於協助設定代操
  const { data: me } = await supabase.from('profiles').select('user_type').eq('id', user.id).maybeSingle()
  if (me?.user_type === 'admin') {
    cookieStore.set(cookieName, ownerId, opts)
    return NextResponse.json({ ownerId, role: 'admin' })
  }

  // 驗證對該 owner 在這個 scope 有 active membership
  const { data: member } = await supabase
    .from('bnb_members')
    .select('role')
    .eq('owner_id', ownerId)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .eq('scope', s)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: '無權管理此業務' }, { status: 403 })

  cookieStore.set(cookieName, ownerId, opts)
  return NextResponse.json({ ownerId, role: member.role })
}
