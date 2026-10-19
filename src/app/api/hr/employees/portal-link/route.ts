import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getUnitContext } from '@/lib/auth/unit-access'
import { companySlugForOwner } from '@/lib/company/fromHost'
import { portalMessage, portalUrl } from '@/lib/hr/portal-link'

export const maxDuration = 120

// 以 Email 寄員工專區連結給員工。body: { employee_ids: string[] }（最多 300）
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email 未設定（RESEND_API_KEY）' }, { status: 503 })
  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.employee_ids) ? b.employee_ids.map(String).slice(0, 300) : []
  if (ids.length === 0) return NextResponse.json({ error: 'employee_ids required' }, { status: 400 })

  const slug = await companySlugForOwner(ctx.ownerId)
  if (!slug) return NextResponse.json({ error: '公司尚未設定子網域' }, { status: 400 })
  const base = `https://${slug}.im-tourist.com`
  const { data: emps } = await ctx.admin.from('hr_employees').select('id, name, email, attendance_no, status')
    .eq('owner_id', ctx.ownerId).in('id', ids)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>'
  let sent = 0
  const noEmail: string[] = [], noAttendance: string[] = [], failed: string[] = []
  for (const e of emps ?? []) {
    const url = portalUrl(base, e.attendance_no)
    if (!url || e.status !== 'active') { noAttendance.push(e.name); continue }
    const email = String(e.email ?? '').trim()
    if (!email) { noEmail.push(e.name); continue }
    try {
      await resend.emails.send({ from, to: [email], subject: 'Trang nhân viên / 員工專區', text: portalMessage(e.name, url) })
      sent++
    } catch { failed.push(e.name) }
  }
  return NextResponse.json({ sent, no_email: noEmail, no_attendance: noAttendance, failed })
}
