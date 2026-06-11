import { NextRequest, NextResponse } from 'next/server'
import { locales, type Locale } from '@/i18n/request'

export async function POST(req: NextRequest) {
  const { locale } = await req.json() as { locale: string }

  if (!locales.includes(locale as Locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  // im-tourist 多子域：語言 cookie 設 domain=.im-tourist.com 跨子域共享，
  // 切一次全站生效，並避免子域 host-only cookie 與舊 cookie 衝突。
  // localhost / preview（vercel.app 等）不設 domain。
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase()
  const cookieDomain = host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined

  const res = NextResponse.json({ ok: true })
  if (cookieDomain) {
    // 清掉可能殘留的 host-only 舊 cookie（與 domain cookie 同名會造成讀取歧義）
    res.cookies.set('locale', '', { path: '/', maxAge: 0 })
  }
  res.cookies.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })
  return res
}
