/**
 * GET /api/e/current（公司子網域）：目前員工專區工作階段的打卡編號。供 /punch 快速入口直接導向。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PORTAL_COOKIE, verifySession } from '@/lib/hr/portal'
import { portalCompany } from '../[no]/_auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const company = await portalCompany(req)
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const eid = verifySession(req.cookies.get(PORTAL_COOKIE)?.value)
  if (!eid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: emp } = await createAdminClient().from('hr_employees').select('attendance_no, status')
    .eq('id', eid).eq('owner_id', company.ownerId).maybeSingle()
  const no = String(emp?.attendance_no ?? '').trim()
  if (!emp || emp.status !== 'active' || !no) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ no })
}
