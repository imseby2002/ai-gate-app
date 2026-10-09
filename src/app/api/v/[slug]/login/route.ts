import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { companyFromHost } from '@/lib/company/fromHost'
import { signSession, verifySession } from '@/lib/hr/portal'
import { VENDOR_COOKIE, vendorLogin } from '@/lib/fin/vendor-portal'

type Ctx = { params: Promise<{ slug: string }> }

// 已登入時回傳填表用的 fill_token（重新整理頁面時沿用工作階段）
export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const company = await companyFromHost(req.headers.get('host') ?? '')
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const vid = verifySession(req.cookies.get(VENDOR_COOKIE)?.value, 'vendor')
  if (!vid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: v } = await admin.from('fin_vendors').select('fill_token, active')
    .eq('id', vid).eq('owner_id', company.ownerId).eq('link_slug', slug).maybeSingle()
  if (!v?.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ token: v.fill_token })
}

// POST { pin }：以公司提供（或自行變更後）的密碼登入
export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const company = await companyFromHost(req.headers.get('host') ?? '')
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { pin } = await req.json().catch(() => ({}))
  if (!pin) return NextResponse.json({ error: '請輸入密碼' }, { status: 400 })
  const r = await vendorLogin(company.ownerId, slug, String(pin))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const res = NextResponse.json({ token: r.fillToken })
  res.cookies.set(VENDOR_COOKIE, signSession(r.vendorId, 'vendor'), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(VENDOR_COOKIE)
  return res
}
