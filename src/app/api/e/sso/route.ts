/**
 * 已登入 ERP 的員工直接進員工專區（不用打卡編號＋生日／密碼）
 * GET /api/e/sso（在公司子網域上呼叫）：登入帳號必須是人事資料綁定的在職員工，否則導回登入頁
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PORTAL_COOKIE, signSession } from '@/lib/hr/portal'
import { portalCompany } from '../[no]/_auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const company = await portalCompany(req)
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const admin = createAdminClient()
  const { data: emp } = await admin.from('hr_employees').select('id, attendance_no')
    .eq('owner_id', company.ownerId).eq('profile_id', user.id).eq('status', 'active').maybeSingle()
  const no = String(emp?.attendance_no ?? '').trim()
  if (!emp || !no) {
    return new NextResponse('此帳號尚未綁定在職員工資料，請聯絡人事。 / Tài khoản chưa liên kết hồ sơ nhân viên, vui lòng liên hệ nhân sự.', {
      status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const res = NextResponse.redirect(new URL(`/e/${encodeURIComponent(no)}`, req.url))
  res.cookies.set(PORTAL_COOKIE, signSession(emp.id), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 })
  return res
}
