import { NextResponse } from 'next/server'
import { getBloggerOAuthUrl } from '@/lib/geo/blogger-token'
import { marketingCompany } from '@/lib/marketing/company'

// Blogger 連結跟著「目前切換的公司」：token 存在公司 owner 名下，同一個登入帳號切換公司可各連不同 Google 帳號
export async function GET() {
  const mkt = await marketingCompany()
  if (!mkt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  try {
    return NextResponse.redirect(getBloggerOAuthUrl(`${appUrl}/api/integrations/blogger/callback`, `${mkt.userId}.${mkt.ownerId}`))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.redirect(`${appUrl}/marketing/geo-writer?blogger_error=${encodeURIComponent(msg)}`)
  }
}
