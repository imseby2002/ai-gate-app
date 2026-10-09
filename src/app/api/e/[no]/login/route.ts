import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_COOKIE, portalLogin, signSession } from '@/lib/hr/portal'
import { portalCompany } from '../_auth'

// POST { secret }：生日（DDMMYYYY）或自設密碼
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params
  const company = await portalCompany(req)
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { secret } = await req.json().catch(() => ({}))
  if (!secret) return NextResponse.json({ error: 'Vui lòng nhập ngày sinh hoặc mật khẩu / 請輸入生日或密碼' }, { status: 400 })

  const r = await portalLogin(company.ownerId, decodeURIComponent(no), String(secret))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

  const res = NextResponse.json({ ok: true, mustSetPin: r.mustSetPin })
  res.cookies.set(PORTAL_COOKIE, signSession(r.employeeId), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 })
  return res
}

// 登出
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(PORTAL_COOKIE)
  return res
}
