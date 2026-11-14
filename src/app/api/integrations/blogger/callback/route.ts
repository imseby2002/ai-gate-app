import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getDriveUserEmail } from '@/lib/google-drive'
import { BLOGGER_PROVIDER } from '@/lib/geo/blogger-token'
import { marketingCompany } from '@/lib/marketing/company'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const [userId, ownerId] = (searchParams.get('state') ?? '').split('.')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const back = (q: string) => NextResponse.redirect(`${appUrl}/marketing/geo-writer?blogger=${q}`)
  if (searchParams.get('error') || !code || !userId || !ownerId) return back('error')

  // state 只是明碼帶著登入者與公司 owner，必須確認目前登入的就是這個人、且目前切換的仍是這家公司
  const mkt = await marketingCompany()
  if (!mkt || mkt.userId !== userId || mkt.ownerId !== ownerId) return back('error')

  const tokens = await exchangeCode(code, `${appUrl}/api/integrations/blogger/callback`)
  if (tokens.error || !tokens.access_token) return back('error')

  const email = await getDriveUserEmail(tokens.access_token)
  const { error } = await mkt.admin.from('user_integrations').upsert({
    user_id: ownerId,
    provider: BLOGGER_PROVIDER,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    email,
  }, { onConflict: 'user_id,provider' })
  if (error) console.error('[blogger/callback] 儲存失敗', error)
  return back(error ? 'error' : 'connected')
}
