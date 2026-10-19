import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { portalCompany } from '../_auth'

// 舊打卡工號的連結：回傳目前工號，前端導向 /e/<新工號>。只回傳工號本身。
export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const no = decodeURIComponent((await params).no).trim()
  const company = await portalCompany(req)
  if (!company || !no) return NextResponse.json({ moved: null })
  const admin = createAdminClient()
  const { data: cur } = await admin.from('hr_employees').select('id').eq('owner_id', company.ownerId).eq('attendance_no', no).limit(1)
  if (cur?.length) return NextResponse.json({ moved: null })
  const { data } = await admin.from('hr_employees').select('attendance_no')
    .eq('owner_id', company.ownerId).eq('status', 'active').contains('prev_attendance_nos', [no]).limit(1)
  const moved = String(data?.[0]?.attendance_no ?? '').trim()
  return NextResponse.json({ moved: moved && moved !== no ? moved : null })
}
